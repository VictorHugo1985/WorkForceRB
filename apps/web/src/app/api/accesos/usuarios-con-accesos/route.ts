import { NextRequest, NextResponse } from 'next/server';
import { pool, checkAdminRole } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT DISTINCT u.id, u.nombre, u.apellido, u.email
       FROM registros_auditoria ra
       JOIN usuarios u ON u.id = ra.usuario_id
       WHERE ra.accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')
       ORDER BY u.apellido, u.nombre`,
    );
    return NextResponse.json({ usuarios: res.rows });
  } finally {
    client.release();
  }
}
