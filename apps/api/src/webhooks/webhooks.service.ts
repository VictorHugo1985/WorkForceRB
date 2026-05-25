import { Injectable, Logger } from '@nestjs/common';
import { EstadoResolucion, TipoEvento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// CrossChex checktype values that map to ENTRADA (check-in)
const CHECKTYPE_ENTRADA = new Set([0, 1, 4]);
// CrossChex checktype values that map to SALIDA (check-out)
const CHECKTYPE_SALIDA = new Set([1, 2, 5]);

// CrossChex sends direction via a separate field in some firmware versions
// Fall back to parity: even = ENTRADA, odd = SALIDA (common convention)
function derivarTipoEvento(payload: any): TipoEvento {
  const direction = payload?.direction ?? payload?.type ?? payload?.checkInOut;
  if (direction === 0 || direction === 'in' || direction === 'ENTRADA') return TipoEvento.ENTRADA;
  if (direction === 1 || direction === 'out' || direction === 'SALIDA') return TipoEvento.SALIDA;
  return TipoEvento.DESCONOCIDO;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processCrossChex(requestId: string, body: any): Promise<void> {
    const serialNumber: string = body?.device?.serial_number ?? body?.deviceSn ?? '';
    const workno: string = String(body?.employee?.workno ?? body?.workno ?? '');
    const checktime: string = body?.checktime ?? body?.time ?? new Date().toISOString();
    const checktype: number = Number(body?.checktype ?? 0);
    const deviceName: string = body?.device?.name ?? body?.deviceName ?? '';
    const firstName: string | null = body?.employee?.first_name ?? body?.firstName ?? null;
    const lastName: string | null = body?.employee?.last_name ?? body?.lastName ?? null;

    // Look up dispositivo and colaborador for resolution
    const [dispositivo, codigo] = await Promise.all([
      serialNumber
        ? this.prisma.dispositivoBiometrico.findFirst({
            where: { numero_serie: serialNumber, activo: true },
            select: { id: true },
          })
        : null,
      workno
        ? this.prisma.codigoColaborador.findFirst({
            where: { codigo_biometrico: workno, activo: true },
            select: { colaborador_id: true },
          })
        : null,
    ]);

    const dispositivoId = dispositivo?.id ?? null;
    const colaboradorId = codigo?.colaborador_id ?? null;

    let estadoResolucion: EstadoResolucion;
    if (!dispositivoId) {
      estadoResolucion = EstadoResolucion.DISPOSITIVO_DESCONOCIDO;
    } else if (!colaboradorId) {
      estadoResolucion = EstadoResolucion.SIN_RESOLVER;
    } else {
      estadoResolucion = EstadoResolucion.RESUELTO;
    }

    const tipoEvento = derivarTipoEvento(body);

    // Upsert to handle CrossChex retries (same requestId)
    const evento = await this.prisma.eventoBiometrico.upsert({
      where: { request_id: requestId },
      create: {
        request_id: requestId,
        dispositivo_id: dispositivoId,
        codigo_biometrico: workno,
        colaborador_id: colaboradorId,
        estado_resolucion: estadoResolucion,
        payload_completo: body,
      },
      update: {},
      select: { id: true, desglose: { select: { id: true } } },
    });

    // Create desglose only if it doesn't exist yet (upsert on retry)
    if (!evento.desglose) {
      try {
        await this.prisma.eventoBiometricoDesglosado.create({
          data: {
            evento_id: evento.id,
            checktime: new Date(checktime),
            checktype,
            tipo_evento: tipoEvento,
            device_serial_number: serialNumber,
            device_name: deviceName,
            employee_workno: workno,
            employee_first_name: firstName,
            employee_last_name: lastName,
          },
        });
      } catch (err) {
        this.logger.error(`Error creating desglose for request ${requestId}: ${(err as Error).message}`);
      }
    }

    this.logger.log(
      `Webhook processed: requestId=${requestId} dispositivo=${dispositivoId ?? 'UNKNOWN'} colaborador=${colaboradorId ?? 'UNKNOWN'} tipo=${tipoEvento} estado=${estadoResolucion}`,
    );
  }
}
