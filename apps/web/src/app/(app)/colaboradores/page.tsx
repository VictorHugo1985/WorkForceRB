import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { ColaboradoresListClient } from './ColaboradoresListClient';

async function getColaboradores() {
  let client;
  try {
    client = await pool.connect();
  } catch {
    return [];
  }
  try {
    const result = await client.query(
      `SELECT c.id, c.nombre, c.apellido, c.cedula, c.telefono, c.activo,
              a.id AS area_id, a.nombre AS area_nombre,
              (SELECT cc.codigo_biometrico FROM codigos_colaborador cc
               WHERE cc.colaborador_id = c.id AND cc.activo = true
               ORDER BY cc.creado_en LIMIT 1) AS workno
       FROM colaboradores c
       LEFT JOIN areas a ON a.id = c.area_id
       ORDER BY c.apellido, c.nombre`,
    );
    return result.rows.map((r) => ({
      id: r.id as string,
      nombre: r.nombre as string,
      apellido: r.apellido as string,
      cedula: r.cedula as string,
      workno: (r.workno ?? '') as string,
      telefono: (r.telefono ?? '') as string,
      activo: r.activo as boolean,
      area: r.area_id ? { id: r.area_id as string, nombre: r.area_nombre as string } : null,
    }));
  } catch (err) {
    console.error('[colaboradores] query error:', err);
    return [];
  } finally {
    client.release();
  }
}


export default async function ColaboradoresPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  try {
    const payload = await verifyToken(token);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
  } catch {
    redirect('/login?reason=expired');
  }

  const colaboradores = await getColaboradores();

  return <ColaboradoresListClient colaboradores={colaboradores} />;
}
