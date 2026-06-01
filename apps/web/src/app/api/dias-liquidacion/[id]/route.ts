import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, assertEditable, assertScope, deriveEstadoDia, calcularTotales, buildJornadas, fetchPunchMap } from '@/lib/liquidacion-db';

const PatchSchema = z.object({
  horasAjustadasSupervisor: z.number().min(0).optional(),
  motivoAjuste: z.string().optional(),
  ajusteTipo: z.enum(['TARIFA_DIA', 'MONTO_FIJO']).optional(),
  ajusteValor: z.number().positive().optional(),
  ajusteDescripcion: z.string().optional(),
  aprobar: z.boolean().optional(),
  marcacionesExcluidas: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  }
  const dto = parsed.data;

  const client = await pool.connect();
  try {
    const diaRes = await client.query(
      `SELECT d.*, ls.id AS liquidacion_id, ls.colaborador_id
       FROM dias_liquidacion d
       JOIN liquidaciones_semanales ls ON ls.id = d.liquidacion_id
       WHERE d.id = $1`,
      [id],
    );
    if (diaRes.rows.length === 0) {
      return NextResponse.json({ message: 'Día de liquidación no encontrado' }, { status: 404 });
    }
    const dia = diaRes.rows[0];

    await assertEditable(client, dia.liquidacion_id);
    await assertScope(client, userId, roles, dia.colaborador_id);

    const horasAjustadas = dto.horasAjustadasSupervisor !== undefined
      ? dto.horasAjustadasSupervisor
      : dia.horas_ajustadas_supervisor !== null ? Number(dia.horas_ajustadas_supervisor) : null;

    const ajusteTipo = dto.ajusteTipo !== undefined ? dto.ajusteTipo : dia.ajuste_tipo;

    const estadoDia = deriveEstadoDia(horasAjustadas, ajusteTipo, dto.aprobar ?? false);

    const sets: string[] = [];
    const queryParams: unknown[] = [id];

    const push = (val: unknown) => { queryParams.push(val); return `$${queryParams.length}`; };

    if (dto.horasAjustadasSupervisor !== undefined) {
      sets.push(`horas_ajustadas_supervisor = ${push(dto.horasAjustadasSupervisor)}`);
      sets.push(`motivo_ajuste = ${push(dto.motivoAjuste ?? null)}`);
    }
    if (dto.ajusteTipo !== undefined) {
      sets.push(`ajuste_tipo = ${push(dto.ajusteTipo)}`);
      sets.push(`ajuste_valor = ${push(dto.ajusteValor ?? null)}`);
      sets.push(`ajuste_descripcion = ${push(dto.ajusteDescripcion ?? null)}`);
    }
    if (dto.marcacionesExcluidas !== undefined) {
      sets.push(`marcaciones_excluidas = ${push(JSON.stringify(dto.marcacionesExcluidas))}`);
    }
    sets.push(`estado_dia = ${push(estadoDia)}`);

    const updRes = await client.query(
      `UPDATE dias_liquidacion SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      queryParams,
    );

    const totales = await calcularTotales(client, dia.liquidacion_id);

    // Enrich the returned dia with computed jornada fields so the frontend store stays consistent
    const updDia = updRes.rows[0];
    const fechaStr = (updDia.fecha as Date).toISOString().slice(0, 10);
    const semanaRes = await client.query(
      `SELECT sl.fecha_inicio::text, sl.fecha_fin::text
       FROM liquidaciones_semanales ls
       JOIN semanas_laborales sl ON sl.id = ls.semana_id
       WHERE ls.id = $1`,
      [dia.liquidacion_id],
    );
    let jornadaFields = {};
    if (semanaRes.rows.length > 0) {
      const { fecha_inicio, fecha_fin } = semanaRes.rows[0];
      const punchMap = await fetchPunchMap(client, dia.colaborador_id, (fecha_inicio as string).slice(0, 10), (fecha_fin as string).slice(0, 10));
      const punches = punchMap.get(fechaStr) ?? [];
      const excluded: string[] = Array.isArray(updDia.marcaciones_excluidas) ? updDia.marcaciones_excluidas : [];
      const jd = buildJornadas(punches, excluded);
      jornadaFields = {
        jornadas: jd.jornadas,
        horasParejadas: jd.horasParejadas,
        marcacionSuelta: jd.marcacionSuelta,
        marcacionSueltaRaw: jd.marcacionSueltaRaw,
        tieneInconsistencia: jd.tieneInconsistencia,
        marcacionesExcluidas: excluded,
        excludedPunchDisplay: jd.excludedPunchDisplay,
      };
    }

    const diaResponse = {
      id: updDia.id,
      fecha: fechaStr,
      horasCalculadas: Number(updDia.horas_calculadas),
      horasAjustadasSupervisor: updDia.horas_ajustadas_supervisor != null ? Number(updDia.horas_ajustadas_supervisor) : null,
      atrasoDetectado: Boolean(updDia.atraso_detectado),
      estadoDia: updDia.estado_dia,
      motivoAjuste: updDia.motivo_ajuste ?? null,
      ajusteTipo: updDia.ajuste_tipo ?? null,
      ajusteValor: updDia.ajuste_valor != null ? Number(updDia.ajuste_valor) : null,
      ajusteDescripcion: updDia.ajuste_descripcion ?? null,
      ...jornadaFields,
    };

    return NextResponse.json({ dia: diaResponse, totales });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}
