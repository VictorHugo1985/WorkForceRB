import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const OK = { code: '200', msg: 'success' };

type TipoEvento = 'ENTRADA' | 'SALIDA' | 'DESCONOCIDO';
type EstadoResolucion = 'RESUELTO' | 'SIN_RESOLVER' | 'DISPOSITIVO_DESCONOCIDO';

function derivarTipoEvento(body: any): TipoEvento {
  const d = body?.direction ?? body?.type ?? body?.checkInOut;
  if (d === 0 || d === 'in'  || d === 'ENTRADA') return 'ENTRADA';
  if (d === 1 || d === 'out' || d === 'SALIDA')  return 'SALIDA';
  return 'DESCONOCIDO';
}

export async function POST(req: NextRequest) {
  const secret = process.env.CROSSCHEX_WEBHOOK_SECRET ?? '';
  const sign   = req.headers.get('authorize-sign') ?? '';

  if (!secret || sign !== secret) {
    return NextResponse.json({ code: '401', msg: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json(OK); }

  const requestId    = req.headers.get('requestid') ?? body?.requestId ?? crypto.randomUUID();
  const serialNumber = String(body?.device?.serial_number ?? body?.deviceSn ?? '');
  const workno       = String(body?.employee?.workno ?? body?.workno ?? '');
  const checktime    = body?.checktime ?? body?.time ?? new Date().toISOString();
  const checktype    = Number(body?.checktype ?? 0);
  const deviceName   = String(body?.device?.name ?? body?.deviceName ?? '');
  const firstName    = body?.employee?.first_name ?? body?.firstName ?? null;
  const lastName     = body?.employee?.last_name  ?? body?.lastName  ?? null;
  const tipoEvento   = derivarTipoEvento(body);

  const client = await pool.connect();
  try {
    // Resolve dispositivo and colaborador
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

    const dispositivoId: string | null  = devRow.rows[0]?.id ?? null;
    const colaboradorId: string | null  = colRow.rows[0]?.colaborador_id ?? null;
    const estado: EstadoResolucion =
      !dispositivoId ? 'DISPOSITIVO_DESCONOCIDO'
      : !colaboradorId ? 'SIN_RESOLVER'
      : 'RESUELTO';

    // Upsert evento (idempotent on request_id)
    const eventoRes = await client.query<{ id: string }>(
      `INSERT INTO eventos_biometricos
         (request_id, dispositivo_id, codigo_biometrico, colaborador_id, estado_resolucion, payload_completo)
       VALUES ($1, $2, $3, $4, $5::\"EstadoResolucion\", $6)
       ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
       RETURNING id`,
      [requestId, dispositivoId, workno, colaboradorId, estado, JSON.stringify(body)],
    );
    const eventoId = eventoRes.rows[0].id;

    // Insert desglose if not yet exists
    await client.query(
      `INSERT INTO eventos_biometricos_desglosados
         (evento_id, checktime, checktype, tipo_evento, device_serial_number,
          device_name, employee_workno, employee_first_name, employee_last_name)
       VALUES ($1, $2, $3, $4::\"TipoEvento\", $5, $6, $7, $8, $9)
       ON CONFLICT (evento_id) DO NOTHING`,
      [eventoId, new Date(checktime), checktype, tipoEvento,
       serialNumber, deviceName, workno, firstName, lastName],
    );
  } catch (err) {
    console.error('[crosschex-webhook]', (err as Error).message);
  } finally {
    client.release();
  }

  return NextResponse.json(OK);
}
