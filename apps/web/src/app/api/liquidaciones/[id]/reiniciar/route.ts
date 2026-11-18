import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, assertEditable, getLiquidacionDetail } from '@/lib/liquidacion-db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const client = await pool.connect();
  try {
    await assertEditable(client, id);

    // Clear all manual marcaciones edits from every day of this liquidation
    await client.query(
      `UPDATE liquidacion_jornada
       SET marcaciones_manuales    = NULL,
           marcaciones_excluidas   = '[]',
           horas_ajustadas_supervisor = NULL,
           estado_dia              = 'SIN_REVISION'
       WHERE liquidacion_id = $1`,
      [id],
    );

    const liqRes = await client.query(
      `SELECT colaborador_id, semana_id FROM liquidacion_colaborador WHERE id = $1`,
      [id],
    );
    const { colaborador_id, semana_id } = liqRes.rows[0];

    // Re-derive detail: self-correction logic will recalculate horas from biometric events
    const result = await getLiquidacionDetail(client, colaborador_id as string, semana_id as string);
    return NextResponse.json(result!.data);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}
