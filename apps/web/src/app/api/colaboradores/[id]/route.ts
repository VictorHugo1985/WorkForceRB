import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const EditSchema = z.object({
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  cedula: z.string().min(1),
  area_id: z.string().uuid(),
  supervisor_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.')] = issue.message;
    }
    return NextResponse.json({ error: 'VALIDATION_ERROR', fields }, { status: 400 });
  }

  const { nombre, apellido, cedula, area_id, supervisor_id } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, nombre, apellido, cedula, area_id, supervisor_id FROM colaboradores WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const prev = existing.rows[0];

    const dupCheck = await client.query(
      `SELECT id FROM colaboradores WHERE cedula = $1 AND id != $2 LIMIT 1`,
      [cedula, id],
    );
    if (dupCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'DUPLICATE_CEDULA', message: 'Ya existe un colaborador con la cédula ingresada.' },
        { status: 409 },
      );
    }

    await client.query(
      `UPDATE colaboradores
       SET nombre = $1, apellido = $2, cedula = $3, area_id = $4, supervisor_id = $5, actualizado_en = now()
       WHERE id = $6`,
      [nombre, apellido, cedula, area_id, supervisor_id ?? null, id],
    );

    try {
      const ip = req.headers.get('x-forwarded-for') ?? null;
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_anteriores, datos_nuevos)
         VALUES ('COLABORADOR_EDITADO', 'Colaborador', $1, $2, $3, $4, $5, $6)`,
        [
          id,
          userId,
          `Edición de datos básicos: ${nombre} ${apellido}`,
          ip,
          JSON.stringify({ nombre: prev.nombre, apellido: prev.apellido, cedula: prev.cedula, area_id: prev.area_id, supervisor_id: prev.supervisor_id }),
          JSON.stringify({ nombre, apellido, cedula, area_id, supervisor_id: supervisor_id ?? null }),
        ],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({
      colaborador: { id, nombre, apellido, cedula, area_id, supervisor_id: supervisor_id ?? null },
    });
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const colRes = await client.query(
      `SELECT c.id, c.nombre, c.apellido, c.cedula, c.activo, c.creado_en,
              a.id AS area_id, a.nombre AS area_nombre,
              u.id AS supervisor_id, u.nombre AS supervisor_nombre, u.apellido AS supervisor_apellido
       FROM colaboradores c
       LEFT JOIN areas a ON a.id = c.area_id
       LEFT JOIN usuarios u ON u.id = c.supervisor_id
       WHERE c.id = $1`,
      [id],
    );
    if (colRes.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const col = colRes.rows[0];

    const tarifaRes = await client.query(
      `SELECT id, valor, unidad, vigente_desde FROM configuraciones_reglas
       WHERE colaborador_id = $1 AND tipo = 'TARIFA_HORA' AND aplica_a = 'COLABORADOR'
         AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
       ORDER BY vigente_desde DESC LIMIT 1`,
      [id],
    );

    const horarioRes = await client.query(
      `SELECT id, valor AS umbral_horas_extra, vigente_desde FROM configuraciones_reglas
       WHERE colaborador_id = $1 AND tipo = 'UMBRAL_HORA_EXTRA' AND aplica_a = 'COLABORADOR'
         AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
       ORDER BY vigente_desde DESC LIMIT 1`,
      [id],
    );

    const codigosRes = await client.query(
      `SELECT cc.id, cc.codigo_biometrico AS workno, cc.activo,
              db.id AS dispositivo_id, db.nombre AS dispositivo_nombre, db.numero_serie
       FROM codigos_colaborador cc
       JOIN dispositivos_biometricos db ON db.id = cc.dispositivo_id
       WHERE cc.colaborador_id = $1 AND cc.activo = true
       ORDER BY cc.creado_en DESC`,
      [id],
    );

    return NextResponse.json({
      id: col.id,
      nombre: col.nombre,
      apellido: col.apellido,
      cedula: col.cedula,
      activo: col.activo,
      creado_en: col.creado_en,
      area: col.area_id ? { id: col.area_id, nombre: col.area_nombre } : null,
      supervisor: col.supervisor_id
        ? { id: col.supervisor_id, nombre: col.supervisor_nombre, apellido: col.supervisor_apellido }
        : null,
      tarifa_vigente: tarifaRes.rows[0] ?? null,
      horario_vigente: horarioRes.rows[0] ?? null,
      codigos_biometricos: codigosRes.rows.map((r) => ({
        id: r.id,
        workno: r.workno,
        activo: r.activo,
        dispositivo: { id: r.dispositivo_id, nombre: r.dispositivo_nombre, numero_serie: r.numero_serie },
      })),
    });
  } finally {
    client.release();
  }
}
