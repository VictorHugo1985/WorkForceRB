import { PoolClient } from 'pg';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, isBlacklisted, COOKIE_NAME } from './auth-server';
import { LiquidacionData } from '@/stores/liquidacion.store';

// ─── Auth helper ─────────────────────────────────────────────────────────────

export async function checkLiquidacionRole(
  req: NextRequest,
): Promise<{ userId: string; roles: string[] } | NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  let payload: { sub: string; jti: string; roles: string[] };
  try {
    payload = await verifyToken(token) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isBlacklisted(payload.jti)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!payload.roles.includes('ADMINISTRADOR') && !payload.roles.includes('SUPERVISOR')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  return { userId: payload.sub, roles: payload.roles };
}

// ─── Guards ──────────────────────────────────────────────────────────────────

export async function assertEditable(client: PoolClient, liquidacionId: string) {
  const r = await client.query(
    `SELECT estado FROM liquidaciones_semanales WHERE id = $1`,
    [liquidacionId],
  );
  if (r.rows.length === 0) throw { status: 404, message: 'Liquidación no encontrada' };
  if (r.rows[0].estado === 'APROBADO')
    throw { status: 409, message: 'La liquidación ya fue aprobada y no puede modificarse' };
}

// Scope restriction removed — all supervisors can access any collaborator.
export async function assertScope(
  _client: PoolClient,
  _userId: string,
  _roles: string[],
  _colaboradorId: string,
): Promise<void> { /* no-op */ }

// ─── Find or create borrador ──────────────────────────────────────────────────

export async function findOrCreateBorrador(
  client: PoolClient,
  colaboradorId: string,
  semanaId: string,
): Promise<string> {
  await client.query(
    `INSERT INTO liquidaciones_semanales (id, colaborador_id, semana_id, estado)
     VALUES (gen_random_uuid(), $1, $2, 'BORRADOR')
     ON CONFLICT (colaborador_id, semana_id) DO NOTHING`,
    [colaboradorId, semanaId],
  );
  const r = await client.query(
    `SELECT id FROM liquidaciones_semanales WHERE colaborador_id = $1 AND semana_id = $2`,
    [colaboradorId, semanaId],
  );
  return r.rows[0].id as string;
}

// ─── Config rule resolver ─────────────────────────────────────────────────────

async function resolveConfigRule(
  client: PoolClient,
  tipo: string,
  colaboradorId: string,
  fecha: string,
): Promise<{ id: string; valor: number } | null> {
  const colabRule = await client.query(
    `SELECT id, valor FROM configuraciones_reglas
     WHERE tipo = $1 AND aplica_a = 'COLABORADOR' AND colaborador_id = $2
       AND vigente_desde <= $3 AND (vigente_hasta IS NULL OR vigente_hasta >= $3)
     ORDER BY vigente_desde DESC LIMIT 1`,
    [tipo, colaboradorId, fecha],
  );
  if (colabRule.rows.length > 0) return { id: colabRule.rows[0].id, valor: Number(colabRule.rows[0].valor) };

  const globalRule = await client.query(
    `SELECT id, valor FROM configuraciones_reglas
     WHERE tipo = $1 AND aplica_a = 'GLOBAL'
       AND vigente_desde <= $2 AND (vigente_hasta IS NULL OR vigente_hasta >= $2)
     ORDER BY vigente_desde DESC LIMIT 1`,
    [tipo, fecha],
  );
  if (globalRule.rows.length > 0) return { id: globalRule.rows[0].id, valor: Number(globalRule.rows[0].valor) };
  return null;
}

// ─── Calculator ───────────────────────────────────────────────────────────────

export function deriveEstadoDia(
  horasAjustadas: number | null,
  descuentoTipo: string | null,
  aprobar: boolean,
): string {
  if (horasAjustadas !== null && descuentoTipo !== null) return 'CON_AJUSTE_Y_DESCUENTO';
  if (descuentoTipo !== null) return 'CON_DESCUENTO';
  if (horasAjustadas !== null) return 'CON_AJUSTE_HORAS';
  if (aprobar) return 'APROBADO';
  return 'SIN_REVISION';
}

export async function calcularTotales(client: PoolClient, liquidacionId: string) {
  const liqRes = await client.query(
    `SELECT ls.id, ls.colaborador_id, ls.semana_id, sl.fecha_fin
     FROM liquidaciones_semanales ls
     JOIN semanas_laborales sl ON sl.id = ls.semana_id
     WHERE ls.id = $1`,
    [liquidacionId],
  );
  if (liqRes.rows.length === 0) throw { status: 404, message: 'Liquidación no encontrada' };
  const liq = liqRes.rows[0];
  const fechaFin: string = liq.fecha_fin.toISOString().slice(0, 10);

  const diasRes = await client.query(
    `SELECT id, fecha, horas_calculadas, horas_ajustadas_supervisor, descuento_tipo, descuento_valor
     FROM dias_liquidacion WHERE liquidacion_id = $1`,
    [liquidacionId],
  );

  const bonosRes = await client.query(
    `SELECT monto FROM bonos WHERE colaborador_id = $1 AND semana_id = $2`,
    [liq.colaborador_id, liq.semana_id],
  );

  const umbralRule = await resolveConfigRule(client, 'UMBRAL_HORA_EXTRA', liq.colaborador_id, fechaFin);
  const umbral = umbralRule?.valor ?? 8;

  const multRule = await resolveConfigRule(client, 'MULTIPLICADOR_HORA_EXTRA', liq.colaborador_id, fechaFin);
  const multiplicador = multRule?.valor ?? 1.5;

  let horasOrdinarias = 0, horasExtra = 0;
  let valorHorasOrdinarias = 0, valorHorasExtra = 0, totalDescuentos = 0;

  for (const dia of diasRes.rows) {
    const fechaDia: string = dia.fecha.toISOString().slice(0, 10);
    const horas = dia.horas_ajustadas_supervisor !== null
      ? Number(dia.horas_ajustadas_supervisor)
      : Number(dia.horas_calculadas);

    const tarifaRule = await resolveConfigRule(client, 'TARIFA_HORA', liq.colaborador_id, fechaDia);
    let tarifa = tarifaRule?.valor ?? 0;

    if (dia.descuento_tipo === 'TARIFA_DIA' && dia.descuento_valor !== null) {
      tarifa = Number(dia.descuento_valor);
    }

    const horasOrd = Math.min(horas, umbral);
    const horasExt = Math.max(horas - umbral, 0);

    horasOrdinarias += horasOrd;
    horasExtra += horasExt;
    valorHorasOrdinarias += horasOrd * tarifa;
    valorHorasExtra += horasExt * tarifa * multiplicador;

    if (dia.descuento_tipo === 'MONTO_FIJO' && dia.descuento_valor !== null) {
      totalDescuentos += Number(dia.descuento_valor);
    }
  }

  const totalBonos = bonosRes.rows.reduce((s: number, b: { monto: string }) => s + Number(b.monto), 0);
  const totalPago = valorHorasOrdinarias + valorHorasExtra + totalBonos - totalDescuentos;
  const calculadoEn = new Date();

  await client.query(
    `UPDATE liquidaciones_semanales SET
       horas_ordinarias = $1, horas_extra = $2,
       valor_horas_ordinarias = $3, valor_horas_extra = $4,
       total_bonos = $5, total_descuentos = $6, total_pago = $7, calculado_en = $8
     WHERE id = $9`,
    [horasOrdinarias, horasExtra, valorHorasOrdinarias, valorHorasExtra,
      totalBonos, totalDescuentos, totalPago, calculadoEn, liquidacionId],
  );

  return { horasOrdinarias, horasExtra, valorHorasOrdinarias, valorHorasExtra,
    totalBonos, totalDescuentos, totalPago, calculadoEn };
}

// ─── Detail loader ────────────────────────────────────────────────────────────

export async function getLiquidacionDetail(
  client: PoolClient,
  colaboradorId: string,
  semanaId: string,
): Promise<{ data: LiquidacionData; semanaFechas: { fechaInicio: string; fechaFin: string } } | null> {
  await findOrCreateBorrador(client, colaboradorId, semanaId);

  const liqRes = await client.query(
    `SELECT id, colaborador_id, semana_id, estado,
            horas_ordinarias, horas_extra, valor_horas_ordinarias, valor_horas_extra,
            total_bonos, total_descuentos, total_pago, calculado_en, aprobado_por, aprobada_en
     FROM liquidaciones_semanales WHERE colaborador_id = $1 AND semana_id = $2`,
    [colaboradorId, semanaId],
  );
  if (liqRes.rows.length === 0) return null;
  const liq = liqRes.rows[0];

  const [diasRes, bonosRes, semanaRes] = await Promise.all([
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
    client.query(
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

  return { data, semanaFechas };
}

// ─── Auto-generate borradores when a semana is created ────────────────────────

export async function generarBorradoresSemana(
  client: PoolClient,
  semanaId: string,
  fechaInicio: string,
  fechaFin: string,
): Promise<void> {
  const colabsRes = await client.query(
    `SELECT id FROM colaboradores WHERE activo = true`,
  );
  if (colabsRes.rows.length === 0) return;

  const colaboradorIds: string[] = colabsRes.rows.map((r) => r.id as string);

  // Batch-insert a BORRADOR liquidacion for every active collaborator
  const insertVals = colaboradorIds
    .map((_, i) => `(gen_random_uuid(), $${i * 2 + 1}, $${i * 2 + 2}, 'BORRADOR')`)
    .join(', ');
  await client.query(
    `INSERT INTO liquidaciones_semanales (id, colaborador_id, semana_id, estado)
     VALUES ${insertVals}
     ON CONFLICT (colaborador_id, semana_id) DO NOTHING`,
    colaboradorIds.flatMap((id) => [id, semanaId]),
  );

  // Fetch resulting liquidacion IDs
  const liqRes = await client.query(
    `SELECT id, colaborador_id FROM liquidaciones_semanales WHERE semana_id = $1`,
    [semanaId],
  );
  const liqByColab = new Map<string, string>(
    liqRes.rows.map((r) => [r.colaborador_id as string, r.id as string]),
  );

  // Query biometric events for the period grouped by collaborator + day
  const eventosRes = await client.query(
    `SELECT
       eb.colaborador_id,
       ebd.checktime::date AS fecha,
       MIN(CASE WHEN ebd.tipo_evento = 'ENTRADA' THEN ebd.checktime END) AS primera_entrada,
       MAX(CASE WHEN ebd.tipo_evento = 'SALIDA'  THEN ebd.checktime END) AS ultima_salida
     FROM eventos_biometricos_desglosados ebd
     JOIN eventos_biometricos eb ON eb.id = ebd.evento_id
     WHERE eb.colaborador_id IS NOT NULL
       AND ebd.checktime::date BETWEEN $1 AND $2
       AND ebd.tipo_evento IN ('ENTRADA', 'SALIDA')
     GROUP BY eb.colaborador_id, ebd.checktime::date`,
    [fechaInicio, fechaFin],
  );

  // Insert one dia_liquidacion per (colaborador, date) with calculated hours
  for (const ev of eventosRes.rows) {
    const liquidacionId = liqByColab.get(ev.colaborador_id as string);
    if (!liquidacionId) continue;

    const entrada: Date | null = ev.primera_entrada ?? null;
    const salida: Date | null = ev.ultima_salida ?? null;
    let horas = 0;
    if (entrada && salida && salida > entrada) {
      horas = Math.round(((salida.getTime() - entrada.getTime()) / 3_600_000) * 100) / 100;
    }

    await client.query(
      `INSERT INTO dias_liquidacion
         (id, liquidacion_id, fecha, horas_calculadas, atraso_detectado, estado_dia)
       VALUES (gen_random_uuid(), $1, $2, $3, false, 'SIN_REVISION')
       ON CONFLICT (liquidacion_id, fecha) DO NOTHING`,
      [liquidacionId, ev.fecha, horas],
    );
  }

  // Recalculate totals for each liquidacion (ignore individual failures)
  for (const liquidacionId of liqByColab.values()) {
    try { await calcularTotales(client, liquidacionId); } catch { /* continue */ }
  }
}
