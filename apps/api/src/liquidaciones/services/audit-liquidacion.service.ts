import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLiquidacionService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    accion: string,
    entidadTipo: string,
    entidadId: string,
    datosAnteriores: unknown,
    datosNuevos: unknown,
    userId: string,
    ip?: string | null,
  ): Promise<void> {
    await this.prisma.registroAuditoria.create({
      data: {
        accion,
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        datos_anteriores: datosAnteriores as object,
        datos_nuevos: datosNuevos as object,
        usuario_id: userId,
        ip_origen: ip ?? null,
      },
    });
  }
}
