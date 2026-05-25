import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OK = { code: '200', msg: 'success' };

const RANGE_24H_MS = 24 * 60 * 60 * 1000;

type TipoEvento = 'ENTRADA' | 'SALIDA' | 'DESCONOCIDO';
type EstadoResolucion = 'RESUELTO' | 'SIN_RESOLVER' | 'DISPOSITIVO_DESCONOCIDO';

function derivarTipoEvento(record: any): TipoEvento {
  // CrossChex Cloud: check_type 0 = entrada, 1 = salida
  const ct = record?.check_type ?? record?.checktype;
  if (ct === 0) return 'ENTRADA';
  if (ct === 1) return 'SALIDA';

  const d = record?.direction ?? record?.type ?? record?.checkInOut;
  if (d === 0 || d === 'in' || d === 'ENTRADA') return 'ENTRADA';
  if (d === 1 || d === 'out' || d === 'SALIDA') return 'SALIDA';
  return 'DESCONOCIDO';
}

// CrossChex Cloud wraps events in body.records[]; fall back to flat body
function normalizeRecords(body: any): any[] {
  if (Array.isArray(body?.records) && body.records.length > 0) return body.records;
  return [body];
}

// CrossChex sends UTC; convert to Venezuela local time (GMT-4) for storage
function toGMTMinus4(dateStr: string): Date {
  const utc = new Date(dateStr);
  return new Date(utc.getTime() - 4 * 60 * 60 * 1000);
}

async function processRecord(record: any, fallbackRequestId: string) {
  const requestId    = record?.uuid ?? fallbackRequestId;
  const serialNumber = String(record?.device?.serial_number ?? record?.deviceSn ?? '');
  const workno       = String(record?.employee?.workno ?? record?.workno ?? '');
  const checktime    = record?.check_time ?? record?.checktime ?? record?.time ?? new Date().toISOString();
  const checktype    = Number(record?.check_type ?? record?.checktype ?? 0);
  const deviceName   = String(record?.device?.name ?? record?.deviceName ?? '');
  const firstName    = record?.employee?.first_name ?? record?.firstName ?? null;
  const lastName     = record?.employee?.last_name  ?? record?.lastName  ?? null;
  const tipoEvento   = derivarTipoEvento(record);

  // T024: warn if check_time is more than 24h in the past or in the future
  const checktimeMs = new Date(checktime).getTime();
  if (Math.abs(Date.now() - checktimeMs) > RANGE_24H_MS) {
    console.warn('[crosschex-webhook] timestamp fuera de rango', {
      requestId,
      checktime,
      diffHours: ((Date.now() - checktimeMs) / 3600000).toFixed(1),
    });
  }

  const client = await pool.connect();
  try {
    const devRow = serialNumber
      ? await client.query(
          `SELECT id FROM dispositivos_biometricos WHERE numero_serie = $1 AND activo = true LIMIT 1`,
          [serialNumber],
        )
      : { rows: [] };

    const colRow = workno
      ? await client.query(
          `SELECT colaborador_id FROM codigos_colaborador WHERE codigo_biometrico = $1 AND activo = true LIMIT 1`,
          [workno],
        )
      : { rows: [] };

    const dispositivoId: string | null = devRow.rows[0]?.id ?? null;
    const colaboradorId: string | null = colRow.rows[0]?.colaborador_id ?? null;
    const estado: EstadoResolucion =
      !dispositivoId ? 'DISPOSITIVO_DESCONOCIDO'
      : !colaboradorId ? 'SIN_RESOLVER'
      : 'RESUELTO';

    const eventoRes = await client.query<{ id: string }>(
      `INSERT INTO eventos_biometricos
         (request_id, dispositivo_id, codigo_biometrico, colaborador_id, estado_resolucion, payload_completo)
       VALUES ($1, $2, $3, $4, $5::\"EstadoResolucion\", $6)
       ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
       RETURNING id`,
      [requestId, dispositivoId, workno, colaboradorId, estado, JSON.stringify(record)],
    );
    const eventoId = eventoRes.rows[0].id;

    await client.query(
      `INSERT INTO eventos_biometricos_desglosados
         (evento_id, checktime, checktype, tipo_evento, device_serial_number,
          device_name, employee_workno, employee_first_name, employee_last_name)
       VALUES ($1, $2, $3, $4::\"TipoEvento\", $5, $6, $7, $8, $9)
       ON CONFLICT (evento_id) DO NOTHING`,
      [eventoId, toGMTMinus4(checktime), checktype, tipoEvento,
       serialNumber, deviceName, workno, firstName, lastName],
    );
  } catch (err) {
    // T025: structured error log with context for debugging
    console.error('[crosschex-webhook] error procesando record', {
      requestId,
      serialNumber,
      workno,
      error: (err as Error).message,
    });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CROSSCHEX_WEBHOOK_SECRET ?? '';
  const sign   = req.headers.get('authorize-sign') ?? '';
  const ip     = req.headers.get('x-forwarded-for') ?? null;

  // T019: audit log for unauthorized access (FR-008)
  if (!secret || sign !== secret) {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, descripcion, ip_origen)
         VALUES ('WEBHOOK_ACCESO_NO_AUTORIZADO', 'authorize-sign inválido o ausente', $1)`,
        [ip],
      );
    } catch { /* audit failure must not block the 401 response */ } finally {
      client.release();
    }
    return NextResponse.json({ code: '401', msg: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json(OK); }

  const fallbackId = req.headers.get('requestid') ?? body?.requestId ?? crypto.randomUUID();
  const records = normalizeRecords(body);

  void Promise.allSettled(records.map((r) => processRecord(r, fallbackId)));

  return NextResponse.json(OK);
}
