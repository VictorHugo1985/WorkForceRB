import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { UsuariosListClient } from '@/components/usuarios/UsuariosListClient';
import type { UsuarioRow } from '@/components/usuarios/UsuariosListClient';

export default async function UsuariosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token!);
  } catch {
    redirect('/login?reason=expired');
  }

  if (isBlacklisted(payload!.jti)) redirect('/login?reason=expired');
  if (!payload!.roles.includes('ADMINISTRADOR')) redirect('/dashboard');

  let usuarios: UsuarioRow[] = [];

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.colaborador_id, u.creado_en,
                COALESCE(
                  json_agg(ur.rol ORDER BY ur.rol) FILTER (WHERE ur.rol IS NOT NULL),
                  '[]'
                ) AS roles,
                c.nombre AS colaborador_nombre, c.apellido AS colaborador_apellido
         FROM usuarios u
         LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
         LEFT JOIN colaboradores c ON c.id = u.colaborador_id
         GROUP BY u.id, u.nombre, u.apellido, u.email, u.activo, u.colaborador_id, u.creado_en,
                  c.nombre, c.apellido
         ORDER BY u.apellido, u.nombre`,
      );
      usuarios = res.rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        apellido: r.apellido,
        email: r.email,
        activo: r.activo,
        roles: r.roles,
        colaborador_id: r.colaborador_id ?? null,
        colaborador_nombre: r.colaborador_nombre
          ? `${r.colaborador_nombre} ${r.colaborador_apellido}`
          : null,
        creado_en: r.creado_en,
      }));
    } finally {
      client.release();
    }
  } catch { /* show empty state */ }

  return (
    <UsuariosListClient
      usuarios={usuarios}
      isAdmin={true}
      currentUserId={payload!.sub}
    />
  );
}
