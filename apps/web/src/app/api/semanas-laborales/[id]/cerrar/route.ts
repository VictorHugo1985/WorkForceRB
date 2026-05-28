import { NextRequest, NextResponse } from 'next/server';
import { pool, checkAdminRole } from '@/lib/auth-server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  const client = await pool.connect();
  try {
    const semana = await client.query(
      `SELECT id, estado FROM semanas_laborales WHERE id = $1`,
      [id],
    );
    if (semana.rows.length === 0) {
      return NextResponse.json({ message: 'Semana no encontrada' }, { status: 404 });
    }
    if (semana.rows[0].estado === 'CERRADA') {
      return NextResponse.json({ message: 'La semana ya está cerrada' }, { status: 409 });
    }

    const res = await client.query(
      `UPDATE semanas_laborales
       SET estado = 'CERRADA', cerrada_por = $1, cerrada_en = now()
       WHERE id = $2
       RETURNING id, fecha_inicio, fecha_fin, estado, creado_en`,
      [userId, id],
    );
    return NextResponse.json(res.rows[0]);
  } finally {
    client.release();
  }
}
