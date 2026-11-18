import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, assertScope } from '@/lib/liquidacion-db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  const { id } = await params;

  const client = await pool.connect();
  try {
    const liqRes = await client.query(
      `SELECT id, colaborador_id, estado FROM liquidacion_colaborador WHERE id = $1`,
      [id],
    );
    if (liqRes.rows.length === 0) {
      return NextResponse.json({ message: 'Liquidación no encontrada' }, { status: 404 });
    }
    const liq = liqRes.rows[0];

    if (liq.estado === 'PAGADO') {
      return NextResponse.json({ message: 'La liquidación ya fue marcada como pagada' }, { status: 409 });
    }
    if (liq.estado !== 'APROBADO') {
      return NextResponse.json({ message: 'Solo se pueden marcar como pagadas las liquidaciones aprobadas' }, { status: 422 });
    }

    await assertScope(client, userId, roles, liq.colaborador_id);

    await client.query(
      `UPDATE liquidacion_colaborador SET estado = 'PAGADO', pagado_por = $1, pagada_en = NOW() WHERE id = $2`,
      [userId, id],
    );

    return NextResponse.json({ estado: 'PAGADO' });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}
