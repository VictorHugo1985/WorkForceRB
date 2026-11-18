// Tipos compartidos (cliente y servidor) del módulo de Evaluaciones del Personal.
// Los valores NUMERIC llegan como string (ej. "25.00").

export interface CriterioEvaluacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  peso: string;
  activo: boolean;
  en_uso: boolean;
}

export interface CriteriosResponse {
  criterios: CriterioEvaluacion[];
  suma_activos: string;
  configuracion_valida: boolean;
}

export interface CriterioVigente {
  id: string;
  nombre: string;
  descripcion: string | null;
  peso: string;
}

export interface CriteriosVigentesResponse {
  criterios: CriterioVigente[];
  suma_activos: string;
  configuracion_valida: boolean;
  config_version: string;
}

export interface ColaboradorEvaluacionRow {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  activo: boolean;
  puntaje_promedio: string | null;
  total_evaluaciones: number;
  ultima_evaluacion: string | null;
}

export interface ColaboradoresEvaluacionResponse {
  total: number;
  page: number;
  limit: number;
  colaboradores: ColaboradorEvaluacionRow[];
}

export type EstadoEvaluacion = 'VIGENTE' | 'ANULADA';

export interface EvaluacionResumen {
  id: string;
  fecha_evaluacion: string;
  creado_en: string;
  evaluador_nombre: string;
  puntaje_final: string;
  estado: EstadoEvaluacion;
}

export interface EvaluacionDetalle {
  id: string;
  colaborador: { id: string; nombre: string; apellido: string };
  fecha_evaluacion: string;
  creado_en: string;
  evaluador_nombre: string;
  puntaje_final: string;
  comentario: string | null;
  estado: EstadoEvaluacion;
  anulacion: { motivo: string; anulada_por_nombre: string; anulada_en: string } | null;
  detalles: { criterio_nombre: string; peso: string; puntaje: number }[];
}

export interface HistorialResponse {
  colaborador: { id: string; nombre: string; apellido: string; cedula: string; activo: boolean };
  resumen: { puntaje_promedio: string | null; total_vigentes: number; ultima_evaluacion: string | null };
  evaluaciones: EvaluacionResumen[];
}

/** Vista previa en cliente; el valor oficial lo calcula el servidor. */
export function previewPuntajeFinal(items: { peso: string; puntaje: number }[]): string {
  let total = 0;
  for (const it of items) total += it.puntaje * Math.round(parseFloat(it.peso) * 100);
  return (Math.round(total / 100) / 100).toFixed(2);
}
