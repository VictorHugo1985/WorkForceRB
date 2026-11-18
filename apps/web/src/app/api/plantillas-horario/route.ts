import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const DIAS_VALIDOS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;

const PlantillaSchema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  dias_laborables: z.array(z.enum(DIAS_VALIDOS)).min(1, 'Seleccione al menos un día'),
  hora_entrada_esperada: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido'),
});

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, nombre, dias_laborables, hora_entrada_esperada::text AS hora_entrada_esperada,
              creado_en, actualizado_en,
              (SELECT count(*) FROM colaboradores WHERE plantilla_horario_id = ph.id)::int AS colaboradores_count
       FROM plantillas_horario ph
       ORDER BY nombre`,
    );
    return NextResponse.json({ plantillas: res.rows });
  } finally {
    client.release();
  }
}

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

  const parsed = PlantillaSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.')] = issue.message;
    }
    return NextResponse.json({ error: 'VALIDATION_ERROR', fields }, { status: 400 });
  }

  const { nombre, dias_laborables, hora_entrada_esperada } = parsed.data;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO plantillas_horario (nombre, dias_laborables, hora_entrada_esperada, creado_por)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, dias_laborables, hora_entrada_esperada::text AS hora_entrada_esperada, creado_en`,
      [nombre, dias_laborables, hora_entrada_esperada, userId],
    );

    try {
      const ip = req.headers.get('x-forwarded-for') ?? null;
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_nuevos)
         VALUES ('PLANTILLA_CREADA', 'PlantillaHorario', $1, $2, $3, $4, $5)`,
        [res.rows[0].id, userId, `Plantilla creada: ${nombre}`, ip, JSON.stringify(parsed.data)],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({ plantilla: res.rows[0] }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === '23505') {
      return NextResponse.json({ error: 'DUPLICATE_NOMBRE', message: 'Ya existe una plantilla con ese nombre.' }, { status: 409 });
    }
    throw err;
  } finally {
    client.release();
  }
}
