import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoLiquidacion, EstadoSemana, RolUsuario } from '@prisma/client';
import { PatchDiaLiquidacionDto } from './dto/patch-dia-liquidacion.dto';
import { CreateBonoDto } from './dto/create-bono.dto';
import { PatchBonoDto } from './dto/patch-bono.dto';
import { CreateSemanaLaboralDto } from './dto/create-semana-laboral.dto';
import { PrismaService } from '../prisma/prisma.service';
import { LiquidacionCalculatorService } from './services/liquidacion-calculator.service';
import { AuditLiquidacionService } from './services/audit-liquidacion.service';

@Injectable()
export class LiquidacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: LiquidacionCalculatorService,
    private readonly audit: AuditLiquidacionService,
  ) {}

  async getLiquidacion(colaboradorId: string, semanaId: string) {
    const liq = await this.prisma.liquidacionSemanal.findFirst({
      where: { colaborador_id: colaboradorId, semana_id: semanaId },
      include: {
        dias: { orderBy: { fecha: 'asc' } },
        semana: true,
        colaborador: true,
      },
    });
    if (!liq) return null;
    const bonos = await this.prisma.bono.findMany({
      where: { colaborador_id: colaboradorId, semana_id: semanaId },
      orderBy: { fecha_dia: 'asc' },
    });
    return { ...liq, bonos };
  }

  async assertEditable(liquidacionId: string): Promise<void> {
    const liq = await this.prisma.liquidacionSemanal.findUnique({
      where: { id: liquidacionId },
      select: { estado: true },
    });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');
    if (liq.estado === EstadoLiquidacion.APROBADO) {
      throw new ConflictException('La liquidación ya fue aprobada y no puede modificarse');
    }
  }

  async assertScope(
    userId: string,
    roles: string[],
    colaboradorId: string,
  ): Promise<void> {
    const isSupervisorOnly =
      roles.includes(RolUsuario.SUPERVISOR) && !roles.includes(RolUsuario.ADMINISTRADOR);
    if (!isSupervisorOnly) return;

    const colaborador = await this.prisma.colaborador.findUnique({
      where: { id: colaboradorId },
      select: { supervisor_id: true },
    });
    if (!colaborador || colaborador.supervisor_id !== userId) {
      throw new ForbiddenException('No tiene acceso a este colaborador');
    }
  }

  async createBono(dto: CreateBonoDto, userId: string, roles: string[]) {
    await this.assertScope(userId, roles, dto.colaboradorId);
    const liquidacion = await this.findOrCreateBorrador(dto.colaboradorId, dto.semanaId);
    await this.assertEditable(liquidacion.id);

    const existing = await this.prisma.bono.findFirst({
      where: {
        colaborador_id: dto.colaboradorId,
        fecha_dia: new Date(dto.fechaDia),
        tipo: dto.tipo,
      },
    });
    if (existing) {
      throw new ConflictException({
        message: `Ya existe un bono de tipo ${dto.tipo} para este día. Edite el existente.`,
        existingBonoId: existing.id,
      });
    }

    const bono = await this.prisma.bono.create({
      data: {
        colaborador_id: dto.colaboradorId,
        semana_id: dto.semanaId,
        fecha_dia: new Date(dto.fechaDia),
        tipo: dto.tipo,
        monto: dto.monto,
        comentario: dto.comentario,
        aprobado_por: userId,
      },
    });

    try {
      await this.audit.log('BONO_CREADO', 'Bono', bono.id, null, bono, userId);
    } catch { /* audit failure must not block response */ }

    const totales = await this.calculator.calcularTotales(liquidacion.id);
    return { bono, totales };
  }

  async patchBono(id: string, dto: PatchBonoDto, userId: string, roles: string[]) {
    const bono = await this.prisma.bono.findUnique({ where: { id } });
    if (!bono) throw new NotFoundException('Bono no encontrado');

    await this.assertScope(userId, roles, bono.colaborador_id);
    const liquidacion = await this.prisma.liquidacionSemanal.findFirst({
      where: { colaborador_id: bono.colaborador_id, semana_id: bono.semana_id },
    });
    if (liquidacion) await this.assertEditable(liquidacion.id);

    const updated = await this.prisma.bono.update({
      where: { id },
      data: {
        ...(dto.monto !== undefined && { monto: dto.monto }),
        ...(dto.comentario !== undefined && { comentario: dto.comentario }),
      },
    });

    try {
      await this.audit.log('BONO_EDITADO', 'Bono', id, bono, updated, userId);
    } catch { /* audit failure must not block response */ }

    let totales = null;
    if (liquidacion) totales = await this.calculator.calcularTotales(liquidacion.id);
    return { bono: updated, totales };
  }

  async deleteBono(id: string, userId: string, roles: string[]) {
    const bono = await this.prisma.bono.findUnique({ where: { id } });
    if (!bono) throw new NotFoundException('Bono no encontrado');

    await this.assertScope(userId, roles, bono.colaborador_id);
    const liquidacion = await this.prisma.liquidacionSemanal.findFirst({
      where: { colaborador_id: bono.colaborador_id, semana_id: bono.semana_id },
    });
    if (liquidacion) await this.assertEditable(liquidacion.id);

    await this.prisma.bono.delete({ where: { id } });

    try {
      await this.audit.log('BONO_ELIMINADO', 'Bono', id, bono, null, userId);
    } catch { /* audit failure must not block response */ }

    let totales = null;
    if (liquidacion) totales = await this.calculator.calcularTotales(liquidacion.id);
    return { totales };
  }

  async getSemanas() {
    return this.prisma.semanaLaboral.findMany({
      orderBy: { fecha_inicio: 'desc' },
    });
  }

  async createSemana(dto: CreateSemanaLaboralDto) {
    const existing = await this.prisma.semanaLaboral.findFirst({
      where: { fecha_inicio: new Date(dto.fechaInicio) },
    });
    if (existing) throw new ConflictException('Ya existe una semana con esa fecha de inicio');

    return this.prisma.semanaLaboral.create({
      data: {
        fecha_inicio: new Date(dto.fechaInicio),
        fecha_fin: new Date(dto.fechaFin),
        estado: EstadoSemana.ABIERTA,
      },
    });
  }

  async cerrarSemana(id: string, userId: string) {
    const semana = await this.prisma.semanaLaboral.findUnique({ where: { id } });
    if (!semana) throw new NotFoundException('Semana no encontrada');
    if (semana.estado === EstadoSemana.CERRADA) {
      throw new ConflictException('La semana ya está cerrada');
    }
    return this.prisma.semanaLaboral.update({
      where: { id },
      data: {
        estado: EstadoSemana.CERRADA,
        cerrada_por: userId,
        cerrada_en: new Date(),
      },
    });
  }

  async getResumen(semanaId: string | undefined, userId: string, roles: string[]) {
    let resolvedSemanaId = semanaId;
    if (!resolvedSemanaId) {
      const semana = await this.prisma.semanaLaboral.findFirst({
        where: { estado: EstadoSemana.ABIERTA },
        orderBy: { fecha_inicio: 'desc' },
      });
      if (!semana) return { semana: null, liquidaciones: [] };
      resolvedSemanaId = semana.id;
    }

    const semana = await this.prisma.semanaLaboral.findUnique({ where: { id: resolvedSemanaId } });
    if (!semana) return { semana: null, liquidaciones: [] };

    const isSupervisorOnly =
      roles.includes(RolUsuario.SUPERVISOR) && !roles.includes(RolUsuario.ADMINISTRADOR);

    const colaboradores = await this.prisma.colaborador.findMany({
      where: {
        activo: true,
        ...(isSupervisorOnly ? { supervisor_id: userId } : {}),
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      include: {
        liquidaciones: {
          where: { semana_id: resolvedSemanaId },
          select: {
            id: true,
            estado: true,
            total_pago: true,
          },
        },
      },
    });

    const liquidaciones = colaboradores.map((c) => {
      const liq = c.liquidaciones[0] ?? null;
      return {
        colaboradorId: c.id,
        colaboradorNombre: c.nombre,
        colaboradorApellido: c.apellido,
        area: null,
        liquidacionId: liq?.id ?? null,
        estado: liq?.estado ?? null,
        totalPago: liq ? Number(liq.total_pago) : null,
      };
    });

    return { semana, liquidaciones };
  }

  async aprobarLiquidacion(id: string, userId: string, roles: string[]) {
    const liq = await this.prisma.liquidacionSemanal.findUnique({ where: { id } });
    if (!liq) throw new NotFoundException('Liquidación no encontrada');
    await this.assertEditable(id);
    await this.assertScope(userId, roles, liq.colaborador_id);

    const updated = await this.prisma.liquidacionSemanal.update({
      where: { id },
      data: {
        estado: EstadoLiquidacion.APROBADO,
        aprobado_por: userId,
        aprobada_en: new Date(),
      },
    });

    try {
      await this.audit.log('LIQUIDACION_APROBADA', 'LiquidacionSemanal', id,
        { estado: liq.estado },
        { estado: updated.estado, aprobado_por: userId, aprobada_en: updated.aprobada_en },
        userId,
      );
    } catch { /* audit failure must not block response */ }

    return {
      id: updated.id,
      estado: updated.estado,
      totalPago: Number(updated.total_pago),
      aprobadoPor: updated.aprobado_por,
      aprobadaEn: updated.aprobada_en,
    };
  }

  async patchDiaLiquidacion(
    id: string,
    dto: PatchDiaLiquidacionDto,
    userId: string,
    roles: string[],
  ) {
    const dia = await this.prisma.diaLiquidacion.findUnique({
      where: { id },
      include: { liquidacion: true },
    });
    if (!dia) throw new NotFoundException('Día de liquidación no encontrado');

    await this.assertEditable(dia.liquidacion.id);
    await this.assertScope(userId, roles, dia.liquidacion.colaborador_id);

    const horasAjustadas =
      dto.horasAjustadasSupervisor !== undefined ? dto.horasAjustadasSupervisor : null;
    const descuentoTipo = dto.descuentoTipo ?? null;

    const estadoDia = this.calculator.deriveEstadoDia(
      dto.horasAjustadasSupervisor !== undefined
        ? dto.horasAjustadasSupervisor
        : dia.horas_ajustadas_supervisor !== null
        ? Number(dia.horas_ajustadas_supervisor)
        : null,
      dto.descuentoTipo !== undefined ? dto.descuentoTipo : dia.descuento_tipo,
      dto.aprobar ?? false,
    );

    const updated = await this.prisma.diaLiquidacion.update({
      where: { id },
      data: {
        ...(dto.horasAjustadasSupervisor !== undefined && {
          horas_ajustadas_supervisor: dto.horasAjustadasSupervisor,
          motivo_ajuste: dto.motivoAjuste ?? null,
        }),
        ...(dto.descuentoTipo !== undefined && {
          descuento_tipo: dto.descuentoTipo,
          descuento_valor: dto.descuentoValor ?? null,
          descuento_motivo: dto.descuentoMotivo ?? null,
        }),
        estado_dia: estadoDia,
      },
    });

    const accion = dto.horasAjustadasSupervisor !== undefined
      ? 'DIA_HORAS_AJUSTADAS'
      : dto.descuentoTipo !== undefined
      ? 'DIA_DESCUENTO_APLICADO'
      : 'DIA_APROBADO';

    try {
      await this.audit.log(accion, 'DiaLiquidacion', id, dia, updated, userId);
    } catch { /* audit failure must not block response */ }

    const totales = await this.calculator.calcularTotales(dia.liquidacion.id);
    return { dia: updated, totales };
  }

  async findOrCreateBorrador(colaboradorId: string, semanaId: string) {
    const liq = await this.prisma.liquidacionSemanal.upsert({
      where: { colaborador_id_semana_id: { colaborador_id: colaboradorId, semana_id: semanaId } },
      create: {
        colaborador_id: colaboradorId,
        semana_id: semanaId,
        estado: EstadoLiquidacion.BORRADOR,
      },
      update: {},
      include: {
        dias: { orderBy: { fecha: 'asc' } },
        semana: true,
        colaborador: true,
      },
    });
    const bonos = await this.prisma.bono.findMany({
      where: { colaborador_id: colaboradorId, semana_id: semanaId },
      orderBy: { fecha_dia: 'asc' },
    });
    return { ...liq, bonos };
  }
}
