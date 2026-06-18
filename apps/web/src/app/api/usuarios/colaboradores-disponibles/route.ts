import { NextRequest, NextResponse } from 'next/server';
import { pool, checkAdminRole } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT c.id, c.nombre, c.apellido, c.cedula
       FROM colaboradores c
       WHERE c.activo = true
         AND NOT EXISTS (
           SELECT 1 FROM usuarios u WHERE u.colaborador_id = c.id
         )
       ORDER BY c.apellido, c.nombre`,
    );
    return NextResponse.json({ colaboradores: res.rows });
  } finally {
    client.release();
  }
}
