import { NextRequest, NextResponse } from 'next/server';
import { pool, checkAdminRole } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT u.id, u.nombre, u.apellido
       FROM usuarios u
       JOIN usuario_roles ur ON ur.usuario_id = u.id
       WHERE u.activo = true
         AND ur.rol IN ('ADMINISTRADOR', 'SUPERVISOR')
       ORDER BY u.apellido, u.nombre`,
    );
    return NextResponse.json({ supervisores: result.rows });
  } finally {
    client.release();
  }
}
