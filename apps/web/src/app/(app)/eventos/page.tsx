import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { EventosClient } from './EventosClient';

async function getDispositivos() {
  const client = await pool.connect();
  try {
    const result = await client.query<{ id: string; nombre: string }>(
      `SELECT id, nombre FROM dispositivos_biometricos WHERE activo = true ORDER BY nombre`,
    );
    return result.rows;
  } catch {
    return [];
  } finally {
    client.release();
  }
}

export default async function EventosPage() {
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

  const dispositivos = await getDispositivos();

  return <EventosClient dispositivos={dispositivos} />;
}
