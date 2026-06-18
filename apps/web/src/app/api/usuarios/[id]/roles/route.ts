import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const ROLES_VALIDOS = ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'] as const;

const RolesSchema = z.object({
  roles: z.array(z.enum(ROLES_VALIDOS)).min(1),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = RolesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { roles } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, activo FROM usuarios WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    if (!roles.includes('ADMINISTRADOR')) {
      const adminCount = await client.query(
        `SELECT COUNT(*) FROM usuarios u
         JOIN usuario_roles ur ON ur.usuario_id = u.id
         WHERE u.activo = true AND ur.rol = 'ADMINISTRADOR' AND u.id != $1`,
        [id],
      );
      if (parseInt(adminCount.rows[0].count, 10) === 0) {
        const currentRoles = await client.query(
          `SELECT rol FROM usuario_roles WHERE usuario_id = $1`,
          [id],
        );
        const hasAdminCurrently = currentRoles.rows.some((r: { rol: string }) => r.rol === 'ADMINISTRADOR');
        if (hasAdminCurrently) {
          return NextResponse.json(
            { error: 'LAST_ADMIN', message: 'No se puede quitar el rol ADMINISTRADOR al último administrador activo.' },
            { status: 422 },
          );
        }
      }
    }

    await client.query(`DELETE FROM usuario_roles WHERE usuario_id = $1`, [id]);
    for (const rol of roles) {
      await client.query(
        `INSERT INTO usuario_roles (usuario_id, rol) VALUES ($1, $2)`,
        [id, rol],
      );
    }
    await client.query(
      `UPDATE usuarios SET roles_actualizados_en = NOW() WHERE id = $1`,
      [id],
    );

    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, datos_nuevos)
         VALUES ('USUARIO_ROLES_ACTUALIZADOS', 'Usuario', $1, $2, $3)`,
        [id, userId, JSON.stringify({ roles })],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({ id, roles });
  } finally {
    client.release();
  }
}
