// Tipos compartidos (cliente y servidor) del Reporte de Horas Trabajadas (feature 025).
// Las horas se calculan exclusivamente a partir de marcaciones biométricas.

export type Periodo = 'trimestre' | 'semestre' | 'anio';
export type Agrupacion = 'mes' | 'semana';

export interface Tramo {
  key: string;
  desde: string;
  hasta: string;
  etiqueta: string;
  parcial: boolean;
  sin_datos: boolean;
}

export interface Celda {
  horas: number;
  incompletos: number;
}

export interface FilaColaborador {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  activo: boolean;
  area_id: string | null;
  area_nombre: string | null;
  celdas: Celda[];
  total_horas: number;
  total_incompletos: number;
}

export interface ReporteHorasResponse {
  periodo: Periodo;
  agrupacion: Agrupacion;
  desde: string;
  hasta: string;
  primera_marcacion: string | null;
  tramos: Tramo[];
  areas: { id: string; nombre: string }[];
  colaboradores: FilaColaborador[];
}

export interface ParJornada {
  entrada: string;
  salida: string;
  horas: number;
}

export interface DiaDetalle {
  fecha: string;
  primera_entrada: string | null;
  ultima_salida: string | null;
  horas: number;
  incompleta: boolean;
  pares: ParJornada[];
  marcacion_suelta: string | null;
}

export interface DetalleHorasResponse {
  colaborador: { id: string; nombre: string; apellido: string };
  desde: string;
  hasta: string;
  total_horas: number;
  dias: DiaDetalle[];
}

export const PERIODO_LABEL: Record<Periodo, string> = {
  trimestre: 'Último trimestre',
  semestre: 'Último semestre',
  anio: 'Último año',
};

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function formatHoras(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function formatFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
