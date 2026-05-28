import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { SemanasListClient } from '@/components/semanas/SemanasListClient';

export default async function SemanasLaboralesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  let payload: { roles: string[]; jti: string };
  try {
    payload = await verifyToken(token) as { roles: string[]; jti: string };
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
  } catch {
    redirect('/login?reason=expired');
  }

  let semanas: { id: string; fecha_inicio: string; fecha_fin: string; estado: string; creado_en: string }[] = [];

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, fecha_inicio, fecha_fin, estado, creado_en FROM semanas_laborales ORDER BY fecha_inicio DESC`,
    );
    semanas = res.rows;
  } catch { /* show empty state */ } finally {
    client.release();
  }

  const isAdmin = payload.roles.includes('ADMINISTRADOR');

  return <SemanasListClient semanas={semanas} isAdmin={isAdmin} />;
}
