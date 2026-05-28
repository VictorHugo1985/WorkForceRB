import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken, isBlacklisted } from '@/lib/auth-server';
import { LiquidacionDetailClient } from '@/components/liquidaciones/LiquidacionDetailClient';
import { LiquidacionData } from '@/stores/liquidacion.store';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export default async function LiquidacionDetailPage({
  params,
}: {
  params: Promise<{ semanaId: string; colaboradorId: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  try {
    const payload = await verifyToken(token);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
  } catch {
    redirect('/login?reason=expired');
  }

  const { semanaId, colaboradorId } = await params;

  let data: LiquidacionData | null = null;
  let semanaFechas = { fechaInicio: '', fechaFin: '' };

  try {
    const [liqRes, semanaRes] = await Promise.all([
      fetch(`${API_URL}/liquidaciones?colaborador_id=${colaboradorId}&semana_id=${semanaId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      fetch(`${API_URL}/semanas-laborales`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
    ]);

    if (liqRes.ok) {
      const raw = await liqRes.json();
      data = mapToLiquidacionData(raw);
    }
    if (semanaRes.ok) {
      const semanas = await semanaRes.json() as { id: string; fecha_inicio: string; fecha_fin: string }[];
      const semana = semanas.find((s) => s.id === semanaId);
      if (semana) {
        semanaFechas = { fechaInicio: semana.fecha_inicio.slice(0, 10), fechaFin: semana.fecha_fin.slice(0, 10) };
      }
    }
  } catch {
    // handled below
  }

  if (!data) notFound();

  return <LiquidacionDetailClient initialData={data} semanaFechas={semanaFechas} />;
}

function mapToLiquidacionData(raw: Record<string, unknown>): LiquidacionData {
  const dias = ((raw.dias as unknown[]) ?? []).map((d: unknown) => {
    const dia = d as Record<string, unknown>;
    return {
      id: dia.id as string,
      fecha: String(dia.fecha).slice(0, 10),
      horasCalculadas: Number(dia.horas_calculadas),
      horasAjustadasSupervisor: dia.horas_ajustadas_supervisor != null ? Number(dia.horas_ajustadas_supervisor) : null,
      atrasoDetectado: Boolean(dia.atraso_detectado),
      estadoDia: dia.estado_dia as string,
      motivoAjuste: (dia.motivo_ajuste as string) ?? null,
      descuentoTipo: (dia.descuento_tipo as string) ?? null,
      descuentoValor: dia.descuento_valor != null ? Number(dia.descuento_valor) : null,
      descuentoMotivo: (dia.descuento_motivo as string) ?? null,
    };
  });

  const bonos = ((raw.bonos as unknown[]) ?? []).map((b: unknown) => {
    const bono = b as Record<string, unknown>;
    return {
      id: bono.id as string,
      fechaDia: String(bono.fecha_dia).slice(0, 10),
      tipo: bono.tipo as string,
      monto: Number(bono.monto),
      comentario: bono.comentario as string,
      aprobadoPor: bono.aprobado_por as string,
      creadoEn: bono.creado_en as string,
    };
  });

  return {
    id: raw.id as string,
    colaboradorId: raw.colaborador_id as string,
    semanaId: raw.semana_id as string,
    estado: raw.estado as string,
    horasOrdinarias: Number(raw.horas_ordinarias),
    horasExtra: Number(raw.horas_extra),
    valorHorasOrdinarias: Number(raw.valor_horas_ordinarias),
    valorHorasExtra: Number(raw.valor_horas_extra),
    totalBonos: Number(raw.total_bonos),
    totalDescuentos: Number(raw.total_descuentos),
    totalPago: Number(raw.total_pago),
    calculadoEn: raw.calculado_en as string,
    aprobadoPor: (raw.aprobado_por as string) ?? null,
    aprobadaEn: (raw.aprobada_en as string) ?? null,
    dias,
    bonos,
  };
}
