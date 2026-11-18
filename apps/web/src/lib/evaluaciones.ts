// Helpers de servidor del módulo de Evaluaciones del Personal (feature 024).
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import type {
  ColaboradoresEvaluacionResponse,
  EvaluacionDetalle,
  HistorialResponse,
} from './evaluaciones-types';

export const ROLES_EVALUACION = ['ADMINISTRADOR', 'SUPERVISOR'];
export const PUNTAJE_MIN = 1;
export const PUNTAJE_MAX = 10;
/** 100.00 % expresado en centésimas. */
export const SUMA_OBJETIVO = 10000;

export const pesoSchema = z
  .number({ message: 'El peso debe ser un número.' })
  .gt(0, 'El peso debe ser mayor a 0%.')
  .lte(100, 'El peso no puede superar 100%.')
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'El peso admite hasta dos decimales.');

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fecha local de operación (GMT-4) en formato YYYY-MM-DD. */
export function todayGMTMinus4(): string {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Convierte un peso ("25.00" | 25) a centésimas enteras (2500), sin errores de coma flotante. */
export function toCentesimas(v: string | number): number {
  return Math.round(Number(v) * 100);
}

export function sumaPesos(pesos: (string | number)[]): number {
  return pesos.reduce<number>((acc, p) => acc + toCentesimas(p), 0);
}

export function formatCentesimas(c: number): string {
  return (c / 100).toFixed(2);
}

/** Puntaje final ponderado: Σ(puntaje × peso / 100), redondeado a 2 decimales. */
export function calcularPuntajeFinal(items: { peso: string | number; puntaje: number }[]): string {
  // puntaje × peso_centésimas = puntaje_final × 10000 → /100 da centésimas del puntaje final.
  const total = items.reduce((acc, it) => acc + it.puntaje * toCentesimas(it.peso), 0);
  return formatCentesimas(Math.round(total / 100));
}

/** Huella de la configuración activa de criterios, para detectar cambios concurrentes. */
export function configVersion(criterios: { id: string; nombre: string; peso: string | number }[]): string {
  const canon = [...criterios]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => `${c.id}:${c.nombre}:${formatCentesimas(toCentesimas(c.peso))}`)
    .join('|');
  return createHash('sha256').update(canon).digest('hex');
}

export async function auditar(
  client: PoolClient,
  a: {
    accion: string;
    entidadTipo: string;
    entidadId: string | null;
    usuarioId: string;
    descripcion: string;
    ip: string | null;
    anteriores?: unknown;
    nuevos?: unknown;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO registros_auditoria
       (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_anteriores, datos_nuevos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      a.accion,
      a.entidadTipo,
      a.entidadId,
      a.usuarioId,
      a.descripcion,
      a.ip,
      a.anteriores === undefined ? null : JSON.stringify(a.anteriores),
      a.nuevos === undefined ? null : JSON.stringify(a.nuevos),
    ],
  );
}

// ── Consultas de lectura ────────────────────────────────────────────────────

export async function listarColaboradoresEvaluacion(
  client: PoolClient,
  opts: { q?: string | null; incluirInactivos?: boolean; page?: number; limit?: number },
): Promise<ColaboradoresEvaluacionResponse> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (!opts.incluirInactivos) conditions.push('c.activo = true');
  const q = opts.q?.trim();
  if (q) {
    params.push(`%${q}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(c.nombre ILIKE ${p} OR c.apellido ILIKE ${p} OR c.cedula ILIKE ${p} OR (c.nombre || ' ' || c.apellido) ILIKE ${p})`,
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [dataRes, countRes] = await Promise.all([
    client.query(
      `SELECT c.id, c.nombre, c.apellido, c.cedula, c.activo,
              agg.promedio, COALESCE(agg.total, 0) AS total, agg.ultima
         FROM colaboradores c
         LEFT JOIN LATERAL (
           SELECT ROUND(AVG(e.puntaje_final), 2)::text AS promedio,
                  COUNT(*)::int                       AS total,
                  to_char(MAX(e.fecha_evaluacion), 'YYYY-MM-DD') AS ultima
             FROM evaluaciones e
            WHERE e.colaborador_id = c.id AND e.estado = 'VIGENTE'
         ) agg ON true
         ${where}
        ORDER BY c.apellido, c.nombre
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    ),
    client.query(`SELECT COUNT(*)::int AS total FROM colaboradores c ${where}`, params),
  ]);

  return {
    total: countRes.rows[0].total,
    page,
    limit,
    colaboradores: dataRes.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      apellido: r.apellido,
      cedula: r.cedula,
      activo: r.activo,
      puntaje_promedio: r.total > 0 ? r.promedio : null,
      total_evaluaciones: r.total,
      ultima_evaluacion: r.ultima ?? null,
    })),
  };
}

export async function obtenerHistorial(
  client: PoolClient,
  colaboradorId: string,
): Promise<HistorialResponse | null> {
  if (!UUID_RE.test(colaboradorId)) return null;
  const colRes = await client.query(
    `SELECT id, nombre, apellido, cedula, activo FROM colaboradores WHERE id = $1`,
    [colaboradorId],
  );
  if (colRes.rows.length === 0) return null;

  const [evRes, resRes] = await Promise.all([
    client.query(
      `SELECT e.id,
              to_char(e.fecha_evaluacion, 'YYYY-MM-DD') AS fecha_evaluacion,
              e.creado_en,
              (u.nombre || ' ' || u.apellido) AS evaluador_nombre,
              e.puntaje_final::text AS puntaje_final,
              e.estado
         FROM evaluaciones e
         JOIN usuarios u ON u.id = e.evaluador_id
        WHERE e.colaborador_id = $1
        ORDER BY e.fecha_evaluacion DESC, e.creado_en DESC`,
      [colaboradorId],
    ),
    client.query(
      `SELECT ROUND(AVG(puntaje_final), 2)::text AS promedio,
              COUNT(*)::int AS total,
              to_char(MAX(fecha_evaluacion), 'YYYY-MM-DD') AS ultima
         FROM evaluaciones
        WHERE colaborador_id = $1 AND estado = 'VIGENTE'`,
      [colaboradorId],
    ),
  ]);

  const r = resRes.rows[0];
  return {
    colaborador: colRes.rows[0],
    resumen: {
      puntaje_promedio: r.total > 0 ? r.promedio : null,
      total_vigentes: r.total,
      ultima_evaluacion: r.ultima ?? null,
    },
    evaluaciones: evRes.rows,
  };
}

export async function fetchEvaluacionDetalle(
  client: PoolClient,
  id: string,
): Promise<EvaluacionDetalle | null> {
  if (!UUID_RE.test(id)) return null;
  const res = await client.query(
    `SELECT e.id,
            to_char(e.fecha_evaluacion, 'YYYY-MM-DD') AS fecha_evaluacion,
            e.creado_en,
            e.puntaje_final::text AS puntaje_final,
            e.comentario, e.estado, e.motivo_anulacion, e.anulada_en,
            c.id AS colaborador_id, c.nombre AS colaborador_nombre, c.apellido AS colaborador_apellido,
            (ev.nombre || ' ' || ev.apellido) AS evaluador_nombre,
            (an.nombre || ' ' || an.apellido) AS anulada_por_nombre
       FROM evaluaciones e
       JOIN colaboradores c ON c.id = e.colaborador_id
       JOIN usuarios ev ON ev.id = e.evaluador_id
       LEFT JOIN usuarios an ON an.id = e.anulada_por
      WHERE e.id = $1`,
    [id],
  );
  if (res.rows.length === 0) return null;
  const e = res.rows[0];

  const det = await client.query(
    `SELECT criterio_nombre, peso::text AS peso, puntaje
       FROM evaluacion_detalles
      WHERE evaluacion_id = $1
      ORDER BY criterio_nombre`,
    [id],
  );

  return {
    id: e.id,
    colaborador: { id: e.colaborador_id, nombre: e.colaborador_nombre, apellido: e.colaborador_apellido },
    fecha_evaluacion: e.fecha_evaluacion,
    creado_en: e.creado_en,
    evaluador_nombre: e.evaluador_nombre,
    puntaje_final: e.puntaje_final,
    comentario: e.comentario,
    estado: e.estado,
    anulacion:
      e.estado === 'ANULADA'
        ? { motivo: e.motivo_anulacion, anulada_por_nombre: e.anulada_por_nombre, anulada_en: e.anulada_en }
        : null,
    detalles: det.rows,
  };
}

/** Criterios activos (para formulario y validación) con suma y huella. */
export async function criteriosActivos(client: PoolClient, forShare = false) {
  const res = await client.query(
    `SELECT id, nombre, descripcion, peso::text AS peso
       FROM criterios_evaluacion
      WHERE activo
      ORDER BY nombre
      ${forShare ? 'FOR SHARE' : ''}`,
  );
  const suma = sumaPesos(res.rows.map((r) => r.peso));
  return {
    criterios: res.rows as { id: string; nombre: string; descripcion: string | null; peso: string }[],
    suma,
    sumaTexto: formatCentesimas(suma),
    valida: suma === SUMA_OBJETIVO,
    version: configVersion(res.rows),
  };
}
