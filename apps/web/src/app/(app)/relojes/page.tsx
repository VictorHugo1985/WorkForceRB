import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { RelojesListClient } from '@/components/relojes/RelojesListClient';

export default async function RelojesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  try {
    const payload = await verifyToken(token!);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
    if (!payload.roles.includes('ADMINISTRADOR')) redirect('/dashboard');
  } catch {
    redirect('/login?reason=expired');
  }

  let dispositivos: {
    id: string;
    nombre: string;
    numero_serie: string | null;
    tipo: 'WEBHOOK' | 'CSV';
    activo: boolean;
    tiene_webhook_secreto: boolean;
    creado_en: string;
    actualizado_en: string;
  }[] = [];

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, nombre, numero_serie, tipo, activo,
                (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto,
                creado_en::text, actualizado_en::text
         FROM dispositivos_biometricos ORDER BY nombre`,
      );
      dispositivos = res.rows;
    } finally {
      client.release();
    }
  } catch {
    /* show empty state */
  }

  return <RelojesListClient dispositivos={dispositivos} isAdmin={true} />;
}
