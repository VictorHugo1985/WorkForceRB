import { Injectable } from '@nestjs/common';
import { EstadoDia, TipoAjusteDia } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface TotalesLiquidacion {
  horasOrdinarias: number;
  horasExtra: number;
  valorHorasOrdinarias: number;
  valorHorasExtra: number;
  totalBonos: number;
  totalDescuentos: number;
  totalPago: number;
  calculadoEn: Date;
}

@Injectable()
export class LiquidacionCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  deriveEstadoDia(
    horasAjustadas: number | null,
    ajusteTipo: TipoAjusteDia | null,
    aprobar: boolean,
  ): EstadoDia {
    if (horasAjustadas !== null && ajusteTipo !== null) return EstadoDia.CON_AJUSTE_Y_DESCUENTO;
    if (ajusteTipo !== null) return EstadoDia.CON_DESCUENTO;
    if (horasAjustadas !== null) return EstadoDia.CON_AJUSTE_HORAS;
    if (aprobar) return EstadoDia.APROBADO;
    return EstadoDia.SIN_REVISION;
  }

  async calcularTotales(liquidacionId: string): Promise<TotalesLiquidacion> {
    const liquidacion = await this.prisma.liquidacionSemanal.findUniqueOrThrow({
      where: { id: liquidacionId },
      include: {
        dias: true,
        semana: true,
        colaborador: true,
      },
    });

    const bonos = await this.prisma.bono.findMany({
      where: {
        colaborador_id: liquidacion.colaborador_id,
        semana_id: liquidacion.semana_id,
      },
    });

    const tarifa = liquidacion.colaborador.tarifa_hora
      ? Number(liquidacion.colaborador.tarifa_hora)
      : 0;

    let horasOrdinarias = 0;
    let valorHorasOrdinarias = 0;
    let totalDescuentos = 0;

    for (const dia of liquidacion.dias) {
      const horas = dia.horas_ajustadas_supervisor !== null
        ? Number(dia.horas_ajustadas_supervisor)
        : Number(dia.horas_calculadas);

      let tarifaEfectiva = tarifa;
      if (dia.ajuste_tipo === TipoAjusteDia.TARIFA_DIA && dia.ajuste_valor !== null) {
        tarifaEfectiva = Number(dia.ajuste_valor);
      }

      const descuentoFijo =
        dia.ajuste_tipo === TipoAjusteDia.MONTO_FIJO && dia.ajuste_valor !== null
          ? Number(dia.ajuste_valor)
          : 0;

      horasOrdinarias += horas;
      valorHorasOrdinarias += horas * tarifaEfectiva;
      totalDescuentos += descuentoFijo;
    }

    const totalBonos = bonos.reduce((sum, b) => sum + Number(b.monto), 0);
    const totalPago = valorHorasOrdinarias + totalBonos - totalDescuentos;
    const calculadoEn = new Date();

    await this.prisma.liquidacionSemanal.update({
      where: { id: liquidacionId },
      data: {
        horas_ordinarias: horasOrdinarias,
        horas_extra: 0,
        valor_horas_ordinarias: valorHorasOrdinarias,
        valor_horas_extra: 0,
        total_bonos: totalBonos,
        total_descuentos: totalDescuentos,
        total_pago: totalPago,
        configuracion_reglas_ids: [],
        calculado_en: calculadoEn,
      },
    });

    return {
      horasOrdinarias,
      horasExtra: 0,
      valorHorasOrdinarias,
      valorHorasExtra: 0,
      totalBonos,
      totalDescuentos,
      totalPago,
      calculadoEn,
    };
  }
}
