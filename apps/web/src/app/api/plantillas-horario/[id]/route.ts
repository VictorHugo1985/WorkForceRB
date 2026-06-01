import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const DIAS_VALIDOS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;

const PlantillaSchema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  dias_laborables: z.array(z.enum(DIAS_VALIDOS)).min(1, 'Seleccione al menos un día'),
  hora_entrada_esperada: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido'),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, nombre, dias_laborables, hora_entrada_esperada::text AS hora_entrada_esperada,
              creado_en, actualizado_en
       FROM plantillas_horario WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ plantilla: res.rows[0] });
  } finally {
    client.release();
  }
}

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
    const existing = await client.query(`SELECT id FROM plantillas_horario WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const res = await client.query(
      `UPDATE plantillas_horario
       SET nombre = $1, dias_laborables = $2, hora_entrada_esperada = $3, actualizado_en = now()
       WHERE id = $4
       RETURNING id, nombre, dias_laborables, hora_entrada_esperada::text AS hora_entrada_esperada, actualizado_en`,
      [nombre, dias_laborables, hora_entrada_esperada, id],
    );

    try {
      const ip = req.headers.get('x-forwarded-for') ?? null;
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_nuevos)
         VALUES ('PLANTILLA_ACTUALIZADA', 'PlantillaHorario', $1, $2, $3, $4, $5)`,
        [id, userId, `Plantilla actualizada: ${nombre}`, ip, JSON.stringify(parsed.data)],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({ plantilla: res.rows[0] });
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const countRes = await client.query(
      `SELECT count(*)::int AS n FROM colaboradores WHERE plantilla_horario_id = $1`,
      [id],
    );
    if (countRes.rows[0].n > 0) {
      return NextResponse.json(
        { error: 'PLANTILLA_EN_USO', message: `No se puede eliminar: ${countRes.rows[0].n} colaborador(es) tienen esta plantilla asignada.` },
        { status: 409 },
      );
    }

    const del = await client.query(`DELETE FROM plantillas_horario WHERE id = $1 RETURNING id`, [id]);
    if (del.rows.length === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    return new NextResponse(null, { status: 204 });
  } finally {
    client.release();
  }
}
