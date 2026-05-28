import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, assertScope } from '@/lib/liquidacion-db';

export async function GET(req: NextRequest) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  const colaboradorId = req.nextUrl.searchParams.get('colaborador_id');
  const semanaId = req.nextUrl.searchParams.get('semana_id');
  if (!colaboradorId || !semanaId) {
    return NextResponse.json({ error: 'Se requiere colaborador_id y semana_id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await assertScope(client, userId, roles, colaboradorId);

    const liqRes = await client.query(
      `SELECT id, colaborador_id, semana_id, estado,
              horas_ordinarias, horas_extra, valor_horas_ordinarias, valor_horas_extra,
              total_bonos, total_descuentos, total_pago, calculado_en, aprobado_por, aprobada_en
       FROM liquidaciones_semanales WHERE colaborador_id = $1 AND semana_id = $2`,
      [colaboradorId, semanaId],
    );
    if (liqRes.rows.length === 0) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }
    const liq = liqRes.rows[0];

    const [diasRes, bonosRes] = await Promise.all([
      client.query(
        `SELECT id, fecha, horas_calculadas, horas_ajustadas_supervisor, atraso_detectado,
                estado_dia, motivo_ajuste, descuento_tipo, descuento_valor, descuento_motivo
         FROM dias_liquidacion WHERE liquidacion_id = $1 ORDER BY fecha`,
        [liq.id],
      ),
      client.query(
        `SELECT id, colaborador_id, semana_id, fecha_dia, tipo, monto, comentario, aprobado_por, creado_en
         FROM bonos WHERE colaborador_id = $1 AND semana_id = $2 ORDER BY fecha_dia`,
        [colaboradorId, semanaId],
      ),
    ]);

    return NextResponse.json({ ...liq, dias: diasRes.rows, bonos: bonosRes.rows });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}
