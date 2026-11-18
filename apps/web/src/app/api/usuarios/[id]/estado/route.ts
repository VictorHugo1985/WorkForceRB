import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const EstadoSchema = z.object({
  activo: z.boolean(),
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

  const parsed = EstadoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { activo } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT u.id, u.activo FROM usuarios u WHERE u.id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    if (!activo) {
      const adminCount = await client.query(
        `SELECT COUNT(*) FROM usuarios u
         JOIN usuario_roles ur ON ur.usuario_id = u.id
         WHERE u.activo = true AND ur.rol = 'ADMINISTRADOR' AND u.id != $1`,
        [id],
      );
      const isAdmin = await client.query(
        `SELECT 1 FROM usuario_roles WHERE usuario_id = $1 AND rol = 'ADMINISTRADOR' LIMIT 1`,
        [id],
      );
      if (isAdmin.rows.length > 0 && parseInt(adminCount.rows[0].count, 10) === 0) {
        return NextResponse.json(
          { error: 'LAST_ADMIN', message: 'No se puede desactivar el último administrador activo.' },
          { status: 422 },
        );
      }
    }

    await client.query(
      `UPDATE usuarios SET activo = $1, actualizado_en = NOW() WHERE id = $2`,
      [activo, id],
    );

    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, datos_nuevos)
         VALUES ($1, 'Usuario', $2, $3, $4)`,
        [
          activo ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO',
          id,
          userId,
          JSON.stringify({ activo }),
        ],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({ id, activo });
  } finally {
    client.release();
  }
}
