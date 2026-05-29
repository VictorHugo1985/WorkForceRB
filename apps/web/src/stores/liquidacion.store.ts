import { create } from 'zustand';

export interface Jornada {
  entrada: string;
  salida: string;
  horas: number;
  entradaRaw: string;
  salidaRaw: string;
}

export interface ExcludedPunch {
  iso: string;
  hhmm: string;
}

export interface DiaLiquidacionData {
  id: string;
  fecha: string;
  horasCalculadas: number;
  horasAjustadasSupervisor: number | null;
  atrasoDetectado: boolean;
  estadoDia: string;
  motivoAjuste: string | null;
  descuentoTipo: string | null;
  descuentoValor: number | null;
  descuentoMotivo: string | null;
  jornadas?: Jornada[];
  horasParejadas?: number;
  marcacionSuelta?: string | null;
  marcacionSueltaRaw?: string | null;
  tieneInconsistencia?: boolean;
  marcacionesExcluidas?: string[];
  excludedPunchDisplay?: ExcludedPunch[];
}

export interface BonoData {
  id: string;
  fechaDia: string;
  tipo: string;
  monto: number;
  comentario: string;
  aprobadoPor: string;
  creadoEn: string;
}

export interface TotalesData {
  horasOrdinarias: number;
  horasExtra: number;
  valorHorasOrdinarias: number;
  valorHorasExtra: number;
  totalBonos: number;
  totalDescuentos: number;
  totalPago: number;
  calculadoEn: string;
}

export interface LiquidacionData {
  id: string;
  colaboradorId: string;
  semanaId: string;
  estado: string;
  horasOrdinarias: number;
  horasExtra: number;
  valorHorasOrdinarias: number;
  valorHorasExtra: number;
  totalBonos: number;
  totalDescuentos: number;
  totalPago: number;
  calculadoEn: string;
  aprobadoPor: string | null;
  aprobadaEn: string | null;
  dias: DiaLiquidacionData[];
  bonos: BonoData[];
}

interface LiquidacionStore {
  liquidacion: LiquidacionData | null;
  setLiquidacion: (data: LiquidacionData) => void;
  applyOptimisticDia: (dia: DiaLiquidacionData) => void;
  reconcileDia: (dia: DiaLiquidacionData) => void;
  applyOptimisticTotales: (totales: Partial<TotalesData>) => void;
  reconcileTotales: (totales: Partial<TotalesData>) => void;
  setAprobado: (aprobadoPor: string, aprobadaEn: string) => void;
}

export const useLiquidacionStore = create<LiquidacionStore>((set) => ({
  liquidacion: null,

  setLiquidacion: (data) => set({ liquidacion: data }),

  applyOptimisticDia: (dia) =>
    set((state) => {
      if (!state.liquidacion) return state;
      return {
        liquidacion: {
          ...state.liquidacion,
          dias: state.liquidacion.dias.map((d) => (d.id === dia.id ? dia : d)),
        },
      };
    }),

  reconcileDia: (dia) =>
    set((state) => {
      if (!state.liquidacion) return state;
      return {
        liquidacion: {
          ...state.liquidacion,
          dias: state.liquidacion.dias.map((d) => (d.id === dia.id ? dia : d)),
        },
      };
    }),

  applyOptimisticTotales: (totales) =>
    set((state) => {
      if (!state.liquidacion) return state;
      return { liquidacion: { ...state.liquidacion, ...totales } };
    }),

  reconcileTotales: (totales) =>
    set((state) => {
      if (!state.liquidacion) return state;
      return { liquidacion: { ...state.liquidacion, ...totales } };
    }),

  setAprobado: (aprobadoPor, aprobadaEn) =>
    set((state) => {
      if (!state.liquidacion) return state;
      return {
        liquidacion: { ...state.liquidacion, estado: 'APROBADO', aprobadoPor, aprobadaEn },
      };
    }),
}));
