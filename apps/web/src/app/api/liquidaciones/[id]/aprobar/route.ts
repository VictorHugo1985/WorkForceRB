import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, assertScope, calcularTotales } from '@/lib/liquidacion-db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  const { id } = await params;

  const client = await pool.connect();
  try {
    const liqRes = await client.query(
      `SELECT id, colaborador_id, estado FROM liquidaciones_semanales WHERE id = $1`,
      [id],
    );
    if (liqRes.rows.length === 0) {
      return NextResponse.json({ message: 'Liquidación no encontrada' }, { status: 404 });
    }
    const liq = liqRes.rows[0];

    if (liq.estado === 'APROBADO') {
      return NextResponse.json({ message: 'La liquidación ya fue aprobada' }, { status: 409 });
    }

    await assertScope(client, userId, roles, liq.colaborador_id);

    const totales = await calcularTotales(client, id);

    await client.query(
      `UPDATE liquidaciones_semanales SET estado = 'APROBADO', aprobado_por = $1, aprobada_en = NOW() WHERE id = $2`,
      [userId, id],
    );

    const updRes = await client.query(
      `SELECT id, colaborador_id, semana_id, estado, horas_ordinarias, horas_extra,
              valor_horas_ordinarias, valor_horas_extra, total_bonos, total_descuentos,
              total_pago, calculado_en, aprobado_por, aprobada_en
       FROM liquidaciones_semanales WHERE id = $1`,
      [id],
    );

    return NextResponse.json({ ...updRes.rows[0], ...totales });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}
