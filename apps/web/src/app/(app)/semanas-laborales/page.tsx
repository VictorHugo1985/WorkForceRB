import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { SemanasListClient } from '@/components/semanas/SemanasListClient';

export default async function SemanasLaboralesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  let roles: string[] = [];
  try {
    const payload = await verifyToken(token!);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
    roles = payload.roles;
  } catch {
    redirect('/login?reason=expired');
  }

  let semanas: { id: string; fecha_inicio: string; fecha_fin: string; estado: string; creado_en: string }[] = [];

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, fecha_inicio, fecha_fin, estado, creado_en FROM semanas_laborales ORDER BY fecha_inicio DESC`,
      );
      semanas = res.rows.map((r) => ({
        id: r.id as string,
        fecha_inicio: String(r.fecha_inicio).slice(0, 10),
        fecha_fin: String(r.fecha_fin).slice(0, 10),
        estado: r.estado as string,
        creado_en: r.creado_en instanceof Date ? r.creado_en.toISOString() : String(r.creado_en),
      }));
    } finally {
      client.release();
    }
  } catch {
    /* show empty state */
  }

  const isAdmin = roles.includes('ADMINISTRADOR');

  return <SemanasListClient semanas={semanas} isAdmin={isAdmin} />;
}
