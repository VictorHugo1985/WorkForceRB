// Motor del Reporte de Horas Trabajadas (feature 025) — solo servidor.
//
// Fuente ÚNICA: marcaciones biométricas (eventos_biometricos_desglosados).
// No se lee ninguna tabla de liquidaciones; solo se reutiliza la función pura de
// emparejamiento `buildJornadas` para que la aritmética sea la misma del sistema.
import type { PoolClient } from 'pg';
import { buildJornadas, type PunchEntry } from './liquidacion-db';
import {
  MESES_CORTOS,
  type Agrupacion,
  type DiaDetalle,
  type FilaColaborador,
  type Periodo,
  type ReporteHorasResponse,
  type Tramo,
} from './horas-trabajadas-types';

export const ROLES_HORAS = ['ADMINISTRADOR', 'SUPERVISOR'];
export const MAX_DIAS_DETALLE = 31;

/** Días extra que se leen antes del rango para que el cruce de medianoche sea estable. */
const BUFFER_DIAS = 3;
/** Máximo de horas entre una entrada huérfana y la salida del día siguiente. */
const MAX_GAP_CRUCE_HORAS = 12;

// ── Fechas (strings YYYY-MM-DD, aritmética en UTC puro) ──────────────────────

export function todayGMTMinus4(): string {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parse(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

function lastDayOfMonth(y: number, m0: number): string {
  return fmt(new Date(Date.UTC(y, m0 + 1, 0)));
}

/** Lunes de la semana ISO que contiene `d`. */
export function isoWeekMonday(d: string): string {
  const dow = parse(d).getUTCDay(); // 0 = domingo
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

/** Clave ISO `YYYY-Www` de la semana que contiene `d`. */
export function isoWeekKey(d: string): { key: string; week: number } {
  const thursday = addDays(isoWeekMonday(d), 3);
  const t = parse(thursday);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.floor((t.getTime() - yearStart) / 86_400_000 / 7) + 1;
  return { key: `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, week };
}

function ddmm(d: string): string {
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}

// ── Período y tramos ─────────────────────────────────────────────────────────

const MESES_ATRAS: Record<Periodo, number> = { trimestre: 2, semestre: 5, anio: 11 };

export function calcularPeriodo(periodo: Periodo, hoy: string): { desde: string; hasta: string } {
  const h = parse(hoy);
  const inicio = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - MESES_ATRAS[periodo], 1));
  return { desde: fmt(inicio), hasta: hoy };
}

export function construirTramos(
  agrupacion: Agrupacion,
  desde: string,
  hasta: string,
  primeraMarcacion: string | null,
): Tramo[] {
  const tramos: Tramo[] = [];
  const sinDatos = (h: string) => primeraMarcacion === null || h < primeraMarcacion;

  if (agrupacion === 'mes') {
    let cursor = desde;
    while (cursor <= hasta) {
      const y = Number(cursor.slice(0, 4));
      const m0 = Number(cursor.slice(5, 7)) - 1;
      const finNatural = lastDayOfMonth(y, m0);
      const fin = finNatural < hasta ? finNatural : hasta;
      tramos.push({
        key: cursor.slice(0, 7),
        desde: cursor,
        hasta: fin,
        etiqueta: `${MESES_CORTOS[m0]} ${y}`,
        parcial: finNatural > hasta,
        sin_datos: sinDatos(fin),
      });
      cursor = addDays(finNatural, 1);
    }
    return tramos;
  }

  // Semanas ISO (lunes a domingo) recortadas a [desde, hasta].
  let lunes = isoWeekMonday(desde);
  while (lunes <= hasta) {
    const domingo = addDays(lunes, 6);
    const ini = lunes < desde ? desde : lunes;
    const fin = domingo < hasta ? domingo : hasta;
    tramos.push({
      key: isoWeekKey(lunes).key,
      desde: ini,
      hasta: fin,
      etiqueta: `${ddmm(ini)} – ${ddmm(fin)}`,
      parcial: domingo > hasta,
      sin_datos: sinDatos(fin),
    });
    lunes = addDays(lunes, 7);
  }
  return tramos;
}

// ── Marcaciones y jornadas ───────────────────────────────────────────────────

export type PunchesPorFecha = Map<string, PunchEntry[]>;

/**
 * Marcaciones agrupadas por colaborador y fecha local, con el cruce de medianoche
 * aplicado (mismas reglas que `fetchPunchMap`). Devuelve solo fechas en [desde, hasta].
 */
export async function fetchMarcacionesLote(
  client: PoolClient,
  desde: string,
  hasta: string,
  colaboradorId?: string,
): Promise<Map<string, PunchesPorFecha>> {
  const desdeBuffer = addDays(desde, -BUFFER_DIAS);
  const hastaBuffer = addDays(hasta, 1);

  const params: unknown[] = [desdeBuffer, hastaBuffer];
  let filtroColab = '';
  if (colaboradorId) {
    params.push(colaboradorId);
    filtroColab = `AND cc.colaborador_id = $${params.length}`;
  }

  // Filtro amplio por checktime (usa el índice) y luego exacto por fecha local.
  const res = await client.query(
    `SELECT cc.colaborador_id,
            (ebd.checktime + make_interval(hours => ebd.utc_offset)) AS checktime_local,
            ((ebd.checktime + make_interval(hours => ebd.utc_offset))::date)::text AS fecha_local,
            COALESCE(ebd.tipo_evento::text, 'ENTRADA') AS tipo
       FROM eventos_biometricos_desglosados ebd
       JOIN codigos_colaborador cc
            ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
      WHERE ebd.checktime >= ($1::date - 1)::timestamptz
        AND ebd.checktime <  ($2::date + 2)::timestamptz
        ${filtroColab}
      ORDER BY cc.colaborador_id, ebd.checktime`,
    params,
  );

  const porColab = new Map<string, PunchesPorFecha>();
  for (const row of res.rows) {
    const fecha = row.fecha_local as string;
    if (fecha < desdeBuffer || fecha > hastaBuffer) continue;
    let mapa = porColab.get(row.colaborador_id);
    if (!mapa) {
      mapa = new Map();
      porColab.set(row.colaborador_id, mapa);
    }
    if (!mapa.has(fecha)) mapa.set(fecha, []);
    mapa.get(fecha)!.push({ time: row.checktime_local as Date, tipo: row.tipo as string });
  }

  for (const mapa of porColab.values()) {
    aplicarCruceMedianoche(mapa);
    for (const fecha of [...mapa.keys()]) {
      if (fecha < desde || fecha > hasta) mapa.delete(fecha);
    }
  }
  return porColab;
}

/** Igual que en `fetchPunchMap`: entrada huérfana + primera SALIDA del día siguiente (≤ 12 h). */
function aplicarCruceMedianoche(mapa: PunchesPorFecha): void {
  const fechas = [...mapa.keys()].sort();
  for (let i = 0; i < fechas.length - 1; i++) {
    const punches = mapa.get(fechas[i]);
    if (!punches || punches.length % 2 === 0) continue;
    const last = punches[punches.length - 1];
    if (last.tipo !== 'ENTRADA') continue;
    if (fechas[i + 1] !== addDays(fechas[i], 1)) continue; // solo el día calendario siguiente
    const next = mapa.get(fechas[i + 1]);
    if (!next?.length) continue;
    const candidate = next[0];
    const gap = (candidate.time.getTime() - last.time.getTime()) / 3_600_000;
    if (candidate.tipo === 'SALIDA' && gap <= MAX_GAP_CRUCE_HORAS) {
      punches.push(candidate);
      next.shift();
      if (!next.length) mapa.delete(fechas[i + 1]);
    }
  }
}

export interface JornadaDia {
  horas: number;
  incompleta: boolean;
  pares: { entrada: string; salida: string; horas: number }[];
  marcacionSuelta: string | null;
}

export function calcularJornadas(porFecha: PunchesPorFecha): Map<string, JornadaDia> {
  const out = new Map<string, JornadaDia>();
  for (const [fecha, punches] of porFecha) {
    const r = buildJornadas(punches, []);
    out.set(fecha, {
      horas: r.horasParejadas,
      incompleta: r.tieneInconsistencia,
      pares: r.jornadas.map((j) => ({ entrada: j.entrada, salida: j.salida, horas: j.horas })),
      marcacionSuelta: r.marcacionSuelta,
    });
  }
  return out;
}

export async function obtenerPrimeraMarcacion(client: PoolClient): Promise<string | null> {
  const res = await client.query(
    `SELECT ((MIN(checktime + make_interval(hours => utc_offset)))::date)::text AS primera
       FROM eventos_biometricos_desglosados`,
  );
  return res.rows[0]?.primera ?? null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Reporte ──────────────────────────────────────────────────────────────────

export async function generarReporte(
  client: PoolClient,
  periodo: Periodo,
  agrupacion: Agrupacion,
): Promise<ReporteHorasResponse> {
  const hoy = todayGMTMinus4();
  const { desde, hasta } = calcularPeriodo(periodo, hoy);

  // Secuencial: un mismo PoolClient no debe ejecutar consultas concurrentes (deprecado en pg@9).
  const primeraMarcacion = await obtenerPrimeraMarcacion(client);
  const colRes = await client.query(
    `SELECT c.id, c.nombre, c.apellido, c.cedula, c.activo, c.area_id, a.nombre AS area_nombre
       FROM colaboradores c
       LEFT JOIN areas a ON a.id = c.area_id
      ORDER BY c.apellido, c.nombre`,
  );
  const areasRes = await client.query(`SELECT id, nombre, activo FROM areas ORDER BY nombre`);
  const marcaciones = await fetchMarcacionesLote(client, desde, hasta);

  const tramos = construirTramos(agrupacion, desde, hasta, primeraMarcacion);

  const colaboradores: FilaColaborador[] = [];
  for (const c of colRes.rows) {
    const jornadas = calcularJornadas(marcaciones.get(c.id) ?? new Map());
    const celdas = tramos.map(() => ({ horas: 0, incompletos: 0 }));
    for (const [fecha, j] of jornadas) {
      // Búsqueda lineal: ≤ 53 tramos.
      const idx = tramos.findIndex((t) => fecha >= t.desde && fecha <= t.hasta);
      if (idx < 0) continue;
      celdas[idx].horas += j.horas;
      if (j.incompleta) celdas[idx].incompletos += 1;
    }
    for (const cel of celdas) cel.horas = round2(cel.horas);
    const total_horas = round2(celdas.reduce((s, x) => s + x.horas, 0));
    const total_incompletos = celdas.reduce((s, x) => s + x.incompletos, 0);

    if (!c.activo && total_horas === 0 && total_incompletos === 0) continue;

    colaboradores.push({
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      cedula: c.cedula,
      activo: c.activo,
      area_id: c.area_id,
      area_nombre: c.area_nombre,
      celdas,
      total_horas,
      total_incompletos,
    });
  }

  const areasUsadas = new Set(colaboradores.map((c) => c.area_id).filter(Boolean));
  const areas = areasRes.rows
    .filter((a) => a.activo || areasUsadas.has(a.id))
    .map((a) => ({ id: a.id as string, nombre: a.nombre as string }));

  return {
    periodo,
    agrupacion,
    desde,
    hasta,
    primera_marcacion: primeraMarcacion,
    tramos,
    areas,
    colaboradores,
  };
}

// ── Detalle diario ───────────────────────────────────────────────────────────

export async function generarDetalle(
  client: PoolClient,
  colaboradorId: string,
  desde: string,
  hasta: string,
): Promise<{ total_horas: number; dias: DiaDetalle[] }> {
  const marcaciones = await fetchMarcacionesLote(client, desde, hasta, colaboradorId);
  const jornadas = calcularJornadas(marcaciones.get(colaboradorId) ?? new Map());
  const dias: DiaDetalle[] = [...jornadas.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([fecha, j]) => ({
      fecha,
      primera_entrada: j.pares[0]?.entrada ?? null,
      ultima_salida: j.pares[j.pares.length - 1]?.salida ?? null,
      horas: j.horas,
      incompleta: j.incompleta,
      pares: j.pares,
      marcacion_suelta: j.marcacionSuelta,
    }));
  return { total_horas: round2(dias.reduce((s, d) => s + d.horas, 0)), dias };
}
