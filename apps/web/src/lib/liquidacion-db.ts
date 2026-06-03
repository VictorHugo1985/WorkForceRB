import { PoolClient } from 'pg';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, isBlacklisted, COOKIE_NAME } from './auth-server';
import { Jornada, ExcludedPunch, LiquidacionData } from '@/stores/liquidacion.store';

// ─── GMT-4 time helper ────────────────────────────────────────────────────────

function toHHMM(d: Date): string {
  const gmt4 = new Date(d.getTime() - 4 * 3600000);
  return `${String(gmt4.getUTCHours()).padStart(2, '0')}:${String(gmt4.getUTCMinutes()).padStart(2, '0')}`;
}

// ─── Shift pairing algorithm ──────────────────────────────────────────────────

export function buildJornadas(
  punches: Date[],
  excludedIso: string[],
): {
  jornadas: Jornada[];
  horasParejadas: number;
  marcacionSuelta: string | null;
  marcacionSueltaRaw: string | null;
  tieneInconsistencia: boolean;
  excludedPunchDisplay: ExcludedPunch[];
} {
  const excludedSet = new Set(excludedIso);
  const excluded = punches.filter((p) => excludedSet.has(p.toISOString()));
  const active = punches.filter((p) => !excludedSet.has(p.toISOString()));

  const jornadas: Jornada[] = [];
  for (let i = 0; i + 1 < active.length; i += 2) {
    const e = active[i], s = active[i + 1];
    jornadas.push({
      entrada: toHHMM(e),
      salida: toHHMM(s),
      horas: Math.round(((s.getTime() - e.getTime()) / 3_600_000) * 100) / 100,
      entradaRaw: e.toISOString(),
      salidaRaw: s.toISOString(),
    });
  }

  const horasParejadas = Math.round(jornadas.reduce((s, j) => s + j.horas, 0) * 100) / 100;
  const tieneInconsistencia = active.length % 2 !== 0;
  const lastActive = active.length > 0 ? active[active.length - 1] : null;

  return {
    jornadas,
    horasParejadas,
    marcacionSuelta: tieneInconsistencia && lastActive ? toHHMM(lastActive) : null,
    marcacionSueltaRaw: tieneInconsistencia && lastActive ? lastActive.toISOString() : null,
    tieneInconsistencia,
    excludedPunchDisplay: excluded.map((p) => ({ iso: p.toISOString(), hhmm: toHHMM(p) })),
  };
}

// ─── Batch punch query ────────────────────────────────────────────────────────

export async function fetchPunchMap(
  client: PoolClient,
  colaboradorId: string,
  fechaInicio: string,
  fechaFin: string,
): Promise<Map<string, Date[]>> {
  const res = await client.query(
    `SELECT ebd.checktime::date AS fecha,
            array_agg(ebd.checktime ORDER BY ebd.checktime) AS marcaciones
     FROM eventos_biometricos_desglosados ebd
     JOIN codigos_colaborador cc
          ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
     WHERE cc.colaborador_id = $1
       AND ebd.checktime::date BETWEEN $2 AND $3
     GROUP BY ebd.checktime::date`,
    [colaboradorId, fechaInicio, fechaFin],
  );
  const map = new Map<string, Date[]>();
  for (const row of res.rows) {
    const key = (row.fecha as Date).toISOString().slice(0, 10);
    map.set(key, row.marcaciones as Date[]);
  }
  return map;
}

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
  if (r.rows[0].estado === 'APROBADO' || r.rows[0].estado === 'PAGADO')
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

// ─── Lateness helper ──────────────────────────────────────────────────────────

function getDiaSemana(fechaISO: string): string {
  const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const d = new Date(fechaISO + 'T12:00:00Z');
  return dias[d.getUTCDay()];
}

// ─── Calculator ───────────────────────────────────────────────────────────────

export function deriveEstadoDia(
  horasAjustadas: number | null,
  ajusteTipo: string | null,
  aprobar: boolean,
): string {
  if (horasAjustadas !== null && ajusteTipo !== null) return 'CON_AJUSTE_Y_DESCUENTO';
  if (ajusteTipo !== null) return 'CON_DESCUENTO';
  if (horasAjustadas !== null) return 'CON_AJUSTE_HORAS';
  if (aprobar) return 'APROBADO';
  return 'SIN_REVISION';
}

export async function calcularTotales(client: PoolClient, liquidacionId: string) {
  const liqRes = await client.query(
    `SELECT ls.id, ls.colaborador_id, ls.semana_id, c.tarifa_hora
     FROM liquidaciones_semanales ls
     JOIN colaboradores c ON c.id = ls.colaborador_id
     WHERE ls.id = $1`,
    [liquidacionId],
  );
  if (liqRes.rows.length === 0) throw { status: 404, message: 'Liquidación no encontrada' };
  const liq = liqRes.rows[0];
  const tarifa = liq.tarifa_hora !== null ? Number(liq.tarifa_hora) : 0;

  const diasRes = await client.query(
    `SELECT id, fecha, horas_calculadas, horas_ajustadas_supervisor, ajuste_tipo, ajuste_valor
     FROM dias_liquidacion WHERE liquidacion_id = $1`,
    [liquidacionId],
  );

  const bonosRes = await client.query(
    `SELECT monto FROM bonos WHERE colaborador_id = $1 AND semana_id = $2`,
    [liq.colaborador_id, liq.semana_id],
  );

  let horasOrdinarias = 0;
  let valorHorasOrdinarias = 0;
  let totalBonosDia = 0;
  let totalDescuentos = 0;

  for (const dia of diasRes.rows) {
    const horas = dia.horas_ajustadas_supervisor !== null
      ? Number(dia.horas_ajustadas_supervisor)
      : Number(dia.horas_calculadas);

    horasOrdinarias += horas;
    valorHorasOrdinarias += Math.round(horas * tarifa * 100) / 100;

    if (dia.ajuste_tipo !== null && dia.ajuste_tipo !== 'DESCUENTO' && dia.ajuste_valor !== null) {
      totalBonosDia += Number(dia.ajuste_valor);
    } else if (dia.ajuste_tipo === 'DESCUENTO' && dia.ajuste_valor !== null) {
      totalDescuentos += Number(dia.ajuste_valor);
    }
  }

  const totalBonos = Math.round(
    (bonosRes.rows.reduce((s: number, b: { monto: string }) => s + Number(b.monto), 0) + totalBonosDia) * 100,
  ) / 100;
  const totalPago = Math.max(0, Math.round((valorHorasOrdinarias + totalBonos - totalDescuentos) * 100) / 100);
  const calculadoEn = new Date();

  await client.query(
    `UPDATE liquidaciones_semanales SET
       horas_ordinarias = $1, horas_extra = 0,
       valor_horas_ordinarias = $2, valor_horas_extra = 0,
       total_bonos = $3, total_descuentos = $4, total_pago = $5, calculado_en = $6
     WHERE id = $7`,
    [horasOrdinarias, valorHorasOrdinarias, totalBonos, totalDescuentos, totalPago, calculadoEn, liquidacionId],
  );

  return { horasOrdinarias, horasExtra: 0, valorHorasOrdinarias, valorHorasExtra: 0,
    totalBonos, totalDescuentos, totalPago, calculadoEn };
}

// ─── Biometric hours calculator (single collaborator) ────────────────────────

async function calcularDiasDesdeEventos(
  client: PoolClient,
  liquidacionId: string,
  colaboradorId: string,
  fechaInicio: string,
  fechaFin: string,
): Promise<void> {
  const punchMap = await fetchPunchMap(client, colaboradorId, fechaInicio, fechaFin);
  if (punchMap.size === 0) return;

  const plantillaRes = await client.query(
    `SELECT ph.dias_laborables, ph.hora_entrada_esperada::text
     FROM colaboradores c
     LEFT JOIN plantillas_horario ph ON ph.id = c.plantilla_horario_id
     WHERE c.id = $1`,
    [colaboradorId],
  );
  const plantilla = plantillaRes.rows[0];

  for (const [fecha, punches] of punchMap) {
    const { horasParejadas } = buildJornadas(punches, []);

    let atrasoDetectado = false;
    if (plantilla?.dias_laborables && plantilla?.hora_entrada_esperada) {
      const diaSemana = getDiaSemana(fecha);
      if ((plantilla.dias_laborables as string[]).includes(diaSemana)) {
        const primeraEntrada = punches.sort((a, b) => a.getTime() - b.getTime())[0];
        if (primeraEntrada) {
          const horaEntrada = toHHMM(primeraEntrada);
          atrasoDetectado = horaEntrada > (plantilla.hora_entrada_esperada as string).slice(0, 5);
        }
      }
    }

    await client.query(
      `INSERT INTO dias_liquidacion
         (id, liquidacion_id, fecha, horas_calculadas, atraso_detectado, estado_dia)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'SIN_REVISION')
       ON CONFLICT (liquidacion_id, fecha) DO NOTHING`,
      [liquidacionId, fecha, horasParejadas, atrasoDetectado],
    );
  }

  try { await calcularTotales(client, liquidacionId); } catch { /* ignore */ }
}

// ─── Detail loader ────────────────────────────────────────────────────────────

export async function getLiquidacionDetail(
  client: PoolClient,
  colaboradorId: string,
  semanaId: string,
): Promise<{ data: LiquidacionData; semanaFechas: { fechaInicio: string; fechaFin: string } } | null> {
  await findOrCreateBorrador(client, colaboradorId, semanaId);

  // Fetch liquidacion + semana dates together
  const [liqRes, semanaRes] = await Promise.all([
    client.query(
      `SELECT id, colaborador_id, semana_id, estado,
              horas_ordinarias, horas_extra, valor_horas_ordinarias, valor_horas_extra,
              total_bonos, total_descuentos, total_pago, calculado_en, aprobado_por, aprobada_en
       FROM liquidaciones_semanales WHERE colaborador_id = $1 AND semana_id = $2`,
      [colaboradorId, semanaId],
    ),
    client.query(
      `SELECT fecha_inicio::text, fecha_fin::text FROM semanas_laborales WHERE id = $1`,
      [semanaId],
    ),
  ]);

  if (liqRes.rows.length === 0) return null;
  const liq = liqRes.rows[0];

  const semana = semanaRes.rows[0];
  const semanaFechas = semana
    ? { fechaInicio: (semana.fecha_inicio as string).slice(0, 10), fechaFin: (semana.fecha_fin as string).slice(0, 10) }
    : { fechaInicio: '', fechaFin: '' };

  // If no dias yet, calculate them from biometric events
  const diasCount = await client.query(
    `SELECT COUNT(*) AS n FROM dias_liquidacion WHERE liquidacion_id = $1`,
    [liq.id],
  );
  if (Number(diasCount.rows[0].n) === 0 && semanaFechas.fechaInicio) {
    await calcularDiasDesdeEventos(
      client, liq.id as string, colaboradorId,
      semanaFechas.fechaInicio, semanaFechas.fechaFin,
    );
  }

  // Re-fetch dias + bonos + punches (dias may have been just created above)
  const [diasRes, bonosRes, punchMap] = await Promise.all([
    client.query(
      `SELECT id, fecha::text, horas_calculadas, horas_ajustadas_supervisor, atraso_detectado,
              estado_dia, motivo_ajuste, ajuste_tipo, ajuste_valor, ajuste_descripcion,
              marcaciones_excluidas, marcaciones_manuales
       FROM dias_liquidacion WHERE liquidacion_id = $1 ORDER BY fecha`,
      [liq.id],
    ),
    client.query(
      `SELECT id, colaborador_id, semana_id, fecha_dia::text, tipo, monto, comentario, aprobado_por, creado_en
       FROM bonos WHERE colaborador_id = $1 AND semana_id = $2 ORDER BY fecha_dia`,
      [colaboradorId, semanaId],
    ),
    semanaFechas.fechaInicio
      ? fetchPunchMap(client, colaboradorId, semanaFechas.fechaInicio, semanaFechas.fechaFin)
      : Promise.resolve(new Map<string, Date[]>()),
  ]);

  // Self-correct SIN_REVISION days whose stored horas_calculadas differ from paired-shift sum
  let needsTotalesRecalc = false;
  for (const d of diasRes.rows) {
    if (d.estado_dia !== 'SIN_REVISION') continue;
    const fecha = (d.fecha as string).slice(0, 10);
    const punches = punchMap.get(fecha) ?? [];
    const excluded: string[] = Array.isArray(d.marcaciones_excluidas) ? d.marcaciones_excluidas : [];
    const { horasParejadas } = buildJornadas(punches, excluded);
    if (Math.abs(horasParejadas - Number(d.horas_calculadas)) > 0.009) {
      await client.query(
        `UPDATE dias_liquidacion SET horas_calculadas = $1 WHERE id = $2`,
        [horasParejadas, d.id],
      );
      d.horas_calculadas = horasParejadas;
      needsTotalesRecalc = true;
    }
  }
  if (needsTotalesRecalc) {
    try { await calcularTotales(client, liq.id as string); } catch { /* ignore */ }
  }

  // Re-read updated totals after possible recalculation
  const liqUpdated = await client.query(
    `SELECT horas_ordinarias, horas_extra, valor_horas_ordinarias, valor_horas_extra,
            total_bonos, total_descuentos, total_pago, calculado_en
     FROM liquidaciones_semanales WHERE id = $1`,
    [liq.id],
  );
  const totals = liqUpdated.rows[0] ?? liq;

  const data: LiquidacionData = {
    id: liq.id,
    colaboradorId: liq.colaborador_id,
    semanaId: liq.semana_id,
    estado: liq.estado,
    horasOrdinarias: Number(totals.horas_ordinarias),
    horasExtra: Number(totals.horas_extra),
    valorHorasOrdinarias: Number(totals.valor_horas_ordinarias),
    valorHorasExtra: Number(totals.valor_horas_extra),
    totalBonos: Number(totals.total_bonos),
    totalDescuentos: Number(totals.total_descuentos),
    totalPago: Number(totals.total_pago),
    calculadoEn: totals.calculado_en,
    aprobadoPor: liq.aprobado_por ?? null,
    aprobadaEn: liq.aprobada_en ?? null,
    dias: diasRes.rows.map((d) => {
      const fecha = (d.fecha as string).slice(0, 10);
      const manuales = d.marcaciones_manuales as Array<{ entrada: string; salida: string }> | null;

      let jornadaFields: {
        jornadas: import('@/stores/liquidacion.store').Jornada[];
        horasParejadas: number;
        marcacionSuelta: string | null;
        marcacionSueltaRaw: string | null;
        tieneInconsistencia: boolean;
        marcacionesExcluidas: string[];
        excludedPunchDisplay: import('@/stores/liquidacion.store').ExcludedPunch[];
        marcacionesManuales: Array<{ entrada: string; salida: string }> | null;
      };

      if (manuales && manuales.length > 0) {
        // Supervisor-edited jornadas take precedence over biometric data
        const horasParejadas = manuales.reduce((sum, j) => {
          const [sh, sm] = j.entrada.split(':').map(Number);
          const [eh, em] = j.salida.split(':').map(Number);
          const diff = (eh * 60 + em) - (sh * 60 + sm);
          return sum + (diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0);
        }, 0);
        jornadaFields = {
          jornadas: manuales.map((j) => {
            const [sh, sm] = j.entrada.split(':').map(Number);
            const [eh, em] = j.salida.split(':').map(Number);
            const diff = (eh * 60 + em) - (sh * 60 + sm);
            return { entrada: j.entrada, salida: j.salida,
              horas: diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0,
              entradaRaw: j.entrada, salidaRaw: j.salida };
          }),
          horasParejadas,
          marcacionSuelta: null,
          marcacionSueltaRaw: null,
          tieneInconsistencia: false,
          marcacionesExcluidas: [],
          excludedPunchDisplay: [],
          marcacionesManuales: manuales,
        };
      } else {
        const punches = punchMap.get(fecha) ?? [];
        const excluded: string[] = Array.isArray(d.marcaciones_excluidas) ? d.marcaciones_excluidas : [];
        const jd = buildJornadas(punches, excluded);
        jornadaFields = {
          jornadas: jd.jornadas,
          horasParejadas: jd.horasParejadas,
          marcacionSuelta: jd.marcacionSuelta,
          marcacionSueltaRaw: jd.marcacionSueltaRaw,
          tieneInconsistencia: jd.tieneInconsistencia,
          marcacionesExcluidas: excluded,
          excludedPunchDisplay: jd.excludedPunchDisplay,
          marcacionesManuales: null,
        };
      }

      return {
        id: d.id,
        fecha,
        horasCalculadas: Number(d.horas_calculadas),
        horasAjustadasSupervisor: d.horas_ajustadas_supervisor != null ? Number(d.horas_ajustadas_supervisor) : null,
        atrasoDetectado: Boolean(d.atraso_detectado),
        estadoDia: d.estado_dia,
        motivoAjuste: d.motivo_ajuste ?? null,
        ajusteTipo: d.ajuste_tipo ?? null,
        ajusteValor: d.ajuste_valor != null ? Number(d.ajuste_valor) : null,
        ajusteDescripcion: d.ajuste_descripcion ?? null,
        ...jornadaFields,
      };
    }),
    bonos: bonosRes.rows.map((b) => ({
      id: b.id,
      fechaDia: (b.fecha_dia as string).slice(0, 10),
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

  // Fetch all punches per collaborator per day using array_agg
  const eventosRes = await client.query(
    `SELECT
       cc.colaborador_id,
       ebd.checktime::date AS fecha,
       array_agg(ebd.checktime ORDER BY ebd.checktime) AS marcaciones
     FROM eventos_biometricos_desglosados ebd
     JOIN codigos_colaborador cc
          ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
     WHERE ebd.checktime::date BETWEEN $1 AND $2
     GROUP BY cc.colaborador_id, ebd.checktime::date`,
    [fechaInicio, fechaFin],
  );

  // Fetch plantilla data per collaborator
  const plantillasRes = await client.query(
    `SELECT c.id AS colaborador_id, ph.dias_laborables, ph.hora_entrada_esperada::text
     FROM colaboradores c
     LEFT JOIN plantillas_horario ph ON ph.id = c.plantilla_horario_id
     WHERE c.id = ANY($1::uuid[])`,
    [colaboradorIds],
  );
  const plantillaPorColab = new Map<string, { dias_laborables: string[]; hora_entrada_esperada: string } | null>(
    plantillasRes.rows.map((r) => [
      r.colaborador_id as string,
      r.dias_laborables ? { dias_laborables: r.dias_laborables as string[], hora_entrada_esperada: r.hora_entrada_esperada as string } : null,
    ]),
  );

  // Insert one dia_liquidacion per (colaborador, date) with paired-shift hours
  for (const ev of eventosRes.rows) {
    const liquidacionId = liqByColab.get(ev.colaborador_id as string);
    if (!liquidacionId) continue;

    const { horasParejadas } = buildJornadas(ev.marcaciones as Date[], []);
    const plantilla = plantillaPorColab.get(ev.colaborador_id as string) ?? null;
    const fecha: string = (ev.fecha as Date).toISOString().slice(0, 10);

    let atrasoDetectado = false;
    if (plantilla) {
      const diaSemana = getDiaSemana(fecha);
      if (plantilla.dias_laborables.includes(diaSemana)) {
        const primeraEntrada = (ev.marcaciones as Date[]).sort((a, b) => a.getTime() - b.getTime())[0];
        if (primeraEntrada) {
          const horaEntrada = toHHMM(primeraEntrada);
          atrasoDetectado = horaEntrada > plantilla.hora_entrada_esperada.slice(0, 5);
        }
      }
    }

    await client.query(
      `INSERT INTO dias_liquidacion
         (id, liquidacion_id, fecha, horas_calculadas, atraso_detectado, estado_dia)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'SIN_REVISION')
       ON CONFLICT (liquidacion_id, fecha) DO NOTHING`,
      [liquidacionId, ev.fecha, horasParejadas, atrasoDetectado],
    );
  }

  // Recalculate totals for each liquidacion (ignore individual failures)
  for (const liquidacionId of liqByColab.values()) {
    try { await calcularTotales(client, liquidacionId); } catch { /* continue */ }
  }
}
