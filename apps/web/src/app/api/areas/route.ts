import { NextRequest, NextResponse } from 'next/server';
import { pool, checkAdminRole } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, nombre FROM areas WHERE activo = true ORDER BY nombre`,
    );
    return NextResponse.json({ areas: result.rows });
  } finally {
    client.release();
  }
}
