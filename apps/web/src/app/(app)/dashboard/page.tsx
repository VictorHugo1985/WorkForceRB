import { pool } from '@/lib/auth-server';
import { DashboardClient } from './DashboardClient';

export interface DispositivoOption {
  serial: string;
  nombre: string;
}

export default async function DashboardPage() {
  let dispositivos: DispositivoOption[] = [];
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT numero_serie AS serial, COALESCE(alias, nombre) AS nombre FROM dispositivos_biometricos WHERE activo = true ORDER BY nombre`,
    );
    dispositivos = res.rows;
  } catch {
  } finally {
    client.release();
  }

  return <DashboardClient dispositivos={dispositivos} />;
}
