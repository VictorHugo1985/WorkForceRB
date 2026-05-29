import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { LiquidacionDetailClient } from '@/components/liquidaciones/LiquidacionDetailClient';
import { LiquidacionData } from '@/stores/liquidacion.store';

export default async function LiquidacionDetailPage({
  params,
}: {
  params: Promise<{ semanaId: string; colaboradorId: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  try {
    const payload = await verifyToken(token!);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
  } catch {
    redirect('/login?reason=expired');
  }

  const { semanaId, colaboradorId } = await params;

  let client;
  try {
    client = await pool.connect();
  } catch {
    notFound();
  }

  try {
    const liqRes = await client!.query(
      `SELECT id, colaborador_id, semana_id, estado,
              horas_ordinarias, horas_extra, valor_horas_ordinarias, valor_horas_extra,
              total_bonos, total_descuentos, total_pago, calculado_en, aprobado_por, aprobada_en
       FROM liquidaciones_semanales WHERE colaborador_id = $1 AND semana_id = $2`,
      [colaboradorId, semanaId],
    );

    if (liqRes.rows.length === 0) notFound();
    const liq = liqRes.rows[0];

    const [diasRes, bonosRes, semanaRes] = await Promise.all([
      client!.query(
        `SELECT id, fecha, horas_calculadas, horas_ajustadas_supervisor, atraso_detectado,
                estado_dia, motivo_ajuste, descuento_tipo, descuento_valor, descuento_motivo
         FROM dias_liquidacion WHERE liquidacion_id = $1 ORDER BY fecha`,
        [liq.id],
      ),
      client!.query(
        `SELECT id, colaborador_id, semana_id, fecha_dia, tipo, monto, comentario, aprobado_por, creado_en
         FROM bonos WHERE colaborador_id = $1 AND semana_id = $2 ORDER BY fecha_dia`,
        [colaboradorId, semanaId],
      ),
      client!.query(
        `SELECT fecha_inicio, fecha_fin FROM semanas_laborales WHERE id = $1`,
        [semanaId],
      ),
    ]);

    const semana = semanaRes.rows[0];
    const semanaFechas = semana
      ? { fechaInicio: String(semana.fecha_inicio).slice(0, 10), fechaFin: String(semana.fecha_fin).slice(0, 10) }
      : { fechaInicio: '', fechaFin: '' };

    const data: LiquidacionData = {
      id: liq.id,
      colaboradorId: liq.colaborador_id,
      semanaId: liq.semana_id,
      estado: liq.estado,
      horasOrdinarias: Number(liq.horas_ordinarias),
      horasExtra: Number(liq.horas_extra),
      valorHorasOrdinarias: Number(liq.valor_horas_ordinarias),
      valorHorasExtra: Number(liq.valor_horas_extra),
      totalBonos: Number(liq.total_bonos),
      totalDescuentos: Number(liq.total_descuentos),
      totalPago: Number(liq.total_pago),
      calculadoEn: liq.calculado_en,
      aprobadoPor: liq.aprobado_por ?? null,
      aprobadaEn: liq.aprobada_en ?? null,
      dias: diasRes.rows.map((d) => ({
        id: d.id,
        fecha: String(d.fecha).slice(0, 10),
        horasCalculadas: Number(d.horas_calculadas),
        horasAjustadasSupervisor: d.horas_ajustadas_supervisor != null ? Number(d.horas_ajustadas_supervisor) : null,
        atrasoDetectado: Boolean(d.atraso_detectado),
        estadoDia: d.estado_dia,
        motivoAjuste: d.motivo_ajuste ?? null,
        descuentoTipo: d.descuento_tipo ?? null,
        descuentoValor: d.descuento_valor != null ? Number(d.descuento_valor) : null,
        descuentoMotivo: d.descuento_motivo ?? null,
      })),
      bonos: bonosRes.rows.map((b) => ({
        id: b.id,
        fechaDia: String(b.fecha_dia).slice(0, 10),
        tipo: b.tipo,
        monto: Number(b.monto),
        comentario: b.comentario,
        aprobadoPor: b.aprobado_por,
        creadoEn: b.creado_en,
      })),
    };

    return <LiquidacionDetailClient initialData={data} semanaFechas={semanaFechas} />;
  } catch (err) {
    const e = err as { digest?: string };
    if (e.digest?.startsWith('NEXT_REDIRECT') || e.digest?.startsWith('NEXT_NOT_FOUND')) throw err;
    notFound();
  } finally {
    client?.release();
  }
}
