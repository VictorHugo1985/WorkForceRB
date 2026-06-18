import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const EditSchema = z.object({
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  cedula: z.string().min(1),
  telefono: z.string().max(30).nullable().optional(),
  fecha_nacimiento: z.string().nullable().optional(),
  supervisor_id: z.string().uuid().nullable().optional(),
  area_id: z.string().uuid().nullable().optional(),
  plantilla_horario_id: z.string().uuid().nullable().optional(),
  tipo_pago: z.enum(['SEMANAL', 'QUINCENAL', 'MENSUAL']).nullable().optional(),
  fijo: z.boolean().optional(),
  codigos: z.array(z.object({ id: z.string().uuid(), workno: z.string().min(1) })).optional(),
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

  const { nombre, apellido, cedula, telefono, fecha_nacimiento, supervisor_id, area_id, plantilla_horario_id, tipo_pago, fijo, codigos } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, nombre, apellido, cedula, supervisor_id, plantilla_horario_id, fijo FROM colaboradores WHERE id = $1`,
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
       SET nombre = $1, apellido = $2, cedula = $3, telefono = $4, fecha_nacimiento = $5,
           supervisor_id = $6, area_id = $7, plantilla_horario_id = $8, tipo_pago = $9, fijo = $10, actualizado_en = now()
       WHERE id = $11`,
      [nombre, apellido, cedula, telefono ?? null, fecha_nacimiento ?? null, supervisor_id ?? null, area_id ?? null, plantilla_horario_id ?? null, tipo_pago ?? null, fijo ?? prev.fijo, id],
    );

    if (codigos && codigos.length > 0) {
      for (const codigo of codigos) {
        try {
          await client.query(
            `UPDATE codigos_colaborador SET codigo_biometrico = $1 WHERE id = $2 AND colaborador_id = $3`,
            [codigo.workno, codigo.id, id],
          );
        } catch (err: unknown) {
          const pg = err as { code?: string };
          if (pg.code === '23505') {
            return NextResponse.json(
              { error: 'DUPLICATE_WORKNO', message: `El workno "${codigo.workno}" ya está asignado a otro colaborador en este dispositivo.` },
              { status: 409 },
            );
          }
          throw err;
        }
      }
    }

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
          JSON.stringify({ nombre: prev.nombre, apellido: prev.apellido, cedula: prev.cedula, supervisor_id: prev.supervisor_id, plantilla_horario_id: prev.plantilla_horario_id, fijo: prev.fijo }),
          JSON.stringify({ nombre, apellido, cedula, supervisor_id: supervisor_id ?? null, plantilla_horario_id: plantilla_horario_id ?? null, fijo: fijo ?? prev.fijo }),
        ],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({
      colaborador: { id, nombre, apellido, cedula, supervisor_id: supervisor_id ?? null, plantilla_horario_id: plantilla_horario_id ?? null },
    });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === '23505') {
      return NextResponse.json({ error: 'CONFLICT', message: 'Conflicto de datos únicos. Verifique los valores ingresados.' }, { status: 409 });
    }
    console.error('[colaboradores PATCH] unexpected error:', e);
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor.' }, { status: 500 });
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
      `SELECT c.id, c.nombre, c.apellido, c.cedula, c.telefono, c.fecha_nacimiento, c.activo, c.fijo, c.creado_en,
              c.tarifa_hora, c.tipo_pago,
              u.id AS supervisor_id, u.nombre AS supervisor_nombre, u.apellido AS supervisor_apellido,
              a.id AS area_id, a.nombre AS area_nombre,
              ph.id AS plantilla_id, ph.nombre AS plantilla_nombre,
              ph.dias_laborables, ph.hora_entrada_esperada::text AS hora_entrada_esperada
       FROM colaboradores c
       LEFT JOIN usuarios u ON u.id = c.supervisor_id
       LEFT JOIN areas a ON a.id = c.area_id
       LEFT JOIN plantillas_horario ph ON ph.id = c.plantilla_horario_id
       WHERE c.id = $1`,
      [id],
    );
    if (colRes.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const col = colRes.rows[0];

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
      telefono: col.telefono ?? null,
      fecha_nacimiento: col.fecha_nacimiento ? col.fecha_nacimiento.toISOString().slice(0, 10) : null,
      activo: col.activo,
      fijo: col.fijo,
      creado_en: col.creado_en,
      tarifa_hora: col.tarifa_hora !== null ? Number(col.tarifa_hora) : null,
      tipo_pago: col.tipo_pago ?? null,
      supervisor: col.supervisor_id
        ? { id: col.supervisor_id, nombre: col.supervisor_nombre, apellido: col.supervisor_apellido }
        : null,
      area: col.area_id ? { id: col.area_id, nombre: col.area_nombre } : null,
      plantilla_horario: col.plantilla_id
        ? {
            id: col.plantilla_id,
            nombre: col.plantilla_nombre,
            dias_laborables: col.dias_laborables,
            hora_entrada_esperada: col.hora_entrada_esperada,
          }
        : null,
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
