import { PoolClient } from 'pg';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, isBlacklisted, COOKIE_NAME } from './auth-server';

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

export async function assertScope(
  client: PoolClient,
  userId: string,
  roles: string[],
  colaboradorId: string,
) {
  const isSupervisorOnly = roles.includes('SUPERVISOR') && !roles.includes('ADMINISTRADOR');
  if (!isSupervisorOnly) return;
  const r = await client.query(
    `SELECT supervisor_id FROM colaboradores WHERE id = $1`,
    [colaboradorId],
  );
  if (r.rows.length === 0 || r.rows[0].supervisor_id !== userId)
    throw { status: 403, message: 'No tiene acceso a este colaborador' };
}

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
