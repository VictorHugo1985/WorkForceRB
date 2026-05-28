import { EstadoDia, EstadoLiquidacion, TipoDescuentoDia, TipoBono } from '@prisma/client';

export class DiaLiquidacionDto {
  id: string;
  fecha: string;
  horasCalculadas: number;
  horasAjustadasSupervisor: number | null;
  atrasoDetectado: boolean;
  estadoDia: EstadoDia;
  motivoAjuste: string | null;
  descuentoTipo: TipoDescuentoDia | null;
  descuentoValor: number | null;
  descuentoMotivo: string | null;
}

export class BonoDto {
  id: string;
  fechaDia: string;
  tipo: TipoBono;
  monto: number;
  comentario: string;
  aprobadoPor: string;
  creadoEn: string;
}

export class LiquidacionResponseDto {
  id: string;
  colaboradorId: string;
  semanaId: string;
  estado: EstadoLiquidacion;
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
  dias: DiaLiquidacionDto[];
  bonos: BonoDto[];
}

export class LiquidacionResumenDto {
  colaboradorId: string;
  colaboradorNombre: string;
  colaboradorApellido: string;
  area: string | null;
  liquidacionId: string | null;
  estado: EstadoLiquidacion | null;
  totalPago: number | null;
}
