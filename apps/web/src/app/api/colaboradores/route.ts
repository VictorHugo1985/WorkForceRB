import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT c.id, c.nombre, c.apellido, c.cedula, c.activo,
              a.id AS area_id, a.nombre AS area_nombre
       FROM colaboradores c
       LEFT JOIN areas a ON a.id = c.area_id
       ORDER BY c.apellido, c.nombre`,
    );
    const colaboradores = result.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      apellido: r.apellido,
      cedula: r.cedula,
      activo: r.activo,
      area: r.area_id ? { id: r.area_id, nombre: r.area_nombre } : null,
    }));
    return NextResponse.json({ colaboradores });
  } finally {
    client.release();
  }
}

const CodigoBiometricoSchema = z.object({
  dispositivo_id: z.string().uuid(),
  workno: z.string().min(1),
});

const ColaboradorSchema = z.object({
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  cedula: z.string().min(1),
  area_id: z.string().uuid(),
  supervisor_id: z.string().uuid().nullable().optional(),
  tarifa_hora: z.number().positive().nullable().optional(),
  umbral_horas_extra: z.number().positive().nullable().optional(),
  codigo_biometrico: CodigoBiometricoSchema.nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = ColaboradorSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.')] = issue.message;
    }
    return NextResponse.json({ error: 'VALIDATION_ERROR', fields }, { status: 400 });
  }

  const { nombre, apellido, cedula, area_id, supervisor_id, tarifa_hora, umbral_horas_extra, codigo_biometrico } = parsed.data;

  const client = await pool.connect();
  try {
    // US2: check cédula duplicada
    const dupCheck = await client.query(
      `SELECT id FROM colaboradores WHERE cedula = $1 LIMIT 1`,
      [cedula],
    );
    if (dupCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'DUPLICATE_CEDULA', message: 'Ya existe un colaborador con la cédula ingresada.' },
        { status: 409 },
      );
    }

    // Insert colaborador (actualizado_en has no DB default — Prisma sets it at app layer)
    const colRes = await client.query<{ id: string }>(
      `INSERT INTO colaboradores (nombre, apellido, cedula, area_id, supervisor_id, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING id`,
      [nombre, apellido, cedula, area_id, supervisor_id ?? null],
    );
    const colaboradorId = colRes.rows[0].id;

    const warnings: string[] = [];
    const configuracionesCreadas: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // Best-effort: tarifa horaria
    if (tarifa_hora) {
      try {
        await client.query(
          `INSERT INTO configuraciones_reglas (tipo, clave, valor, unidad, aplica_a, colaborador_id, vigente_desde, creado_por)
           VALUES ('TARIFA_HORA', 'Tarifa hora ordinaria', $1, 'Bs.', 'COLABORADOR', $2, $3, $4)`,
          [tarifa_hora, colaboradorId, today, userId],
        );
        configuracionesCreadas.push('TARIFA_HORA');
      } catch (err: any) {
        warnings.push(`Tarifa no configurada: ${err.message}`);
      }
    } else {
      warnings.push('Sin tarifa configurada: se usará la tarifa global vigente al momento de liquidar.');
    }

    // Best-effort: umbral horas extra
    if (umbral_horas_extra) {
      try {
        await client.query(
          `INSERT INTO configuraciones_reglas (tipo, clave, valor, unidad, aplica_a, colaborador_id, vigente_desde, creado_por)
           VALUES ('UMBRAL_HORA_EXTRA', 'Umbral horas extra diarias', $1, 'horas', 'COLABORADOR', $2, $3, $4)`,
          [umbral_horas_extra, colaboradorId, today, userId],
        );
        configuracionesCreadas.push('UMBRAL_HORA_EXTRA');
      } catch (err: any) {
        warnings.push(`Horario no configurado: ${err.message}`);
      }
    }

    // Best-effort: código biométrico
    let codigoBiometricoCreado = false;
    if (codigo_biometrico) {
      try {
        await client.query(
          `INSERT INTO codigos_colaborador (colaborador_id, dispositivo_id, codigo_biometrico)
           VALUES ($1, $2, $3)`,
          [colaboradorId, codigo_biometrico.dispositivo_id, codigo_biometrico.workno],
        );
        codigoBiometricoCreado = true;
      } catch (err: any) {
        if (err.code === '23505') {
          warnings.push(`Código biométrico no asignado: workno '${codigo_biometrico.workno}' ya está activo en el dispositivo seleccionado.`);
        } else {
          warnings.push(`Código biométrico no asignado: ${err.message}`);
        }
      }
    }

    // Best-effort: audit log
    try {
      const ip = req.headers.get('x-forwarded-for') ?? null;
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_nuevos)
         VALUES ('COLABORADOR_REGISTRADO', 'Colaborador', $1, $2, $3, $4, $5)`,
        [
          colaboradorId,
          userId,
          `Registro de nuevo colaborador: ${nombre} ${apellido}`,
          ip,
          JSON.stringify({ nombre, apellido, cedula, area_id, supervisor_id, tarifa_hora, umbral_horas_extra, codigo_biometrico }),
        ],
      );
    } catch { /* audit failure does not block response */ }

    const colaboradorRow = await client.query(
      `SELECT id, nombre, apellido, cedula, area_id, supervisor_id, activo, creado_en FROM colaboradores WHERE id = $1`,
      [colaboradorId],
    );

    return NextResponse.json(
      {
        colaborador: colaboradorRow.rows[0],
        configuraciones_creadas: configuracionesCreadas,
        codigo_biometrico_creado: codigoBiometricoCreado,
        warnings,
      },
      { status: 201 },
    );
  } finally {
    client.release();
  }
}
