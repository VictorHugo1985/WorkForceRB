import { Injectable } from '@nestjs/common';
import { EstadoDia, TipoDescuentoDia, TipoConfiguracion, AplicaA } from '@prisma/client';
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
    descuentoTipo: TipoDescuentoDia | null,
    aprobar: boolean,
  ): EstadoDia {
    if (horasAjustadas !== null && descuentoTipo !== null) return EstadoDia.CON_AJUSTE_Y_DESCUENTO;
    if (descuentoTipo !== null) return EstadoDia.CON_DESCUENTO;
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

    const umbralRegla = await this.resolveConfigRule(
      TipoConfiguracion.UMBRAL_HORA_EXTRA,
      liquidacion.colaborador_id,
      liquidacion.semana.fecha_fin,
    );
    const umbral = umbralRegla ? Number(umbralRegla.valor) : 8;

    const multiplicadorRegla = await this.resolveConfigRule(
      TipoConfiguracion.MULTIPLICADOR_HORA_EXTRA,
      liquidacion.colaborador_id,
      liquidacion.semana.fecha_fin,
    );
    const multiplicador = multiplicadorRegla ? Number(multiplicadorRegla.valor) : 1.5;

    const usedRuleIds: string[] = [];
    if (umbralRegla) usedRuleIds.push(umbralRegla.id);
    if (multiplicadorRegla) usedRuleIds.push(multiplicadorRegla.id);

    let horasOrdinarias = 0;
    let horasExtra = 0;
    let valorHorasOrdinarias = 0;
    let valorHorasExtra = 0;
    let totalDescuentos = 0;

    for (const dia of liquidacion.dias) {
      const horas = dia.horas_ajustadas_supervisor !== null
        ? Number(dia.horas_ajustadas_supervisor)
        : Number(dia.horas_calculadas);

      const tarifaRegla = await this.resolveConfigRule(
        TipoConfiguracion.TARIFA_HORA,
        liquidacion.colaborador_id,
        dia.fecha,
      );
      if (tarifaRegla) usedRuleIds.push(tarifaRegla.id);

      let tarifaEfectiva = tarifaRegla ? Number(tarifaRegla.valor) : 0;
      if (dia.descuento_tipo === TipoDescuentoDia.TARIFA_DIA && dia.descuento_valor !== null) {
        tarifaEfectiva = Number(dia.descuento_valor);
      }

      const horasOrd = Math.min(horas, umbral);
      const horasExt = Math.max(horas - umbral, 0);
      const tarifaExtra = tarifaEfectiva * multiplicador;

      const descuentoFijo =
        dia.descuento_tipo === TipoDescuentoDia.MONTO_FIJO && dia.descuento_valor !== null
          ? Number(dia.descuento_valor)
          : 0;

      horasOrdinarias += horasOrd;
      horasExtra += horasExt;
      valorHorasOrdinarias += horasOrd * tarifaEfectiva;
      valorHorasExtra += horasExt * tarifaExtra;
      totalDescuentos += descuentoFijo;
    }

    const totalBonos = bonos.reduce((sum, b) => sum + Number(b.monto), 0);
    const totalPago = valorHorasOrdinarias + valorHorasExtra + totalBonos - totalDescuentos;
    const calculadoEn = new Date();

    const uniqueRuleIds = [...new Set(usedRuleIds)];

    await this.prisma.liquidacionSemanal.update({
      where: { id: liquidacionId },
      data: {
        horas_ordinarias: horasOrdinarias,
        horas_extra: horasExtra,
        valor_horas_ordinarias: valorHorasOrdinarias,
        valor_horas_extra: valorHorasExtra,
        total_bonos: totalBonos,
        total_descuentos: totalDescuentos,
        total_pago: totalPago,
        configuracion_reglas_ids: uniqueRuleIds,
        calculado_en: calculadoEn,
      },
    });

    return {
      horasOrdinarias,
      horasExtra,
      valorHorasOrdinarias,
      valorHorasExtra,
      totalBonos,
      totalDescuentos,
      totalPago,
      calculadoEn,
    };
  }

  private async resolveConfigRule(
    tipo: TipoConfiguracion,
    colaboradorId: string,
    fecha: Date,
  ) {
    const colaboradorRule = await this.prisma.configuracionRegla.findFirst({
      where: {
        tipo,
        aplica_a: AplicaA.COLABORADOR,
        colaborador_id: colaboradorId,
        vigente_desde: { lte: fecha },
        OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: fecha } }],
      },
      orderBy: { vigente_desde: 'desc' },
    });
    if (colaboradorRule) return colaboradorRule;

    return this.prisma.configuracionRegla.findFirst({
      where: {
        tipo,
        aplica_a: AplicaA.GLOBAL,
        vigente_desde: { lte: fecha },
        OR: [{ vigente_hasta: null }, { vigente_hasta: { gte: fecha } }],
      },
      orderBy: { vigente_desde: 'desc' },
    });
  }
}
