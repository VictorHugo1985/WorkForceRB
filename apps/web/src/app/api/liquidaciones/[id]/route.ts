import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, getLiquidacionDetail } from '@/lib/liquidacion-db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const client = await pool.connect();
  try {
    const liqRes = await client.query(
      `SELECT colaborador_id, semana_id FROM liquidacion_colaborador WHERE id = $1`,
      [id],
    );
    if (liqRes.rows.length === 0) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }
    const { colaborador_id, semana_id } = liqRes.rows[0];

    const result = await getLiquidacionDetail(client, colaborador_id as string, semana_id as string);
    if (!result) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } finally {
    client.release();
  }
}
