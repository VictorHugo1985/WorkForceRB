import { NextRequest, NextResponse } from 'next/server';
import { pool, verifyToken, isBlacklisted, COOKIE_NAME, AuthPayload } from '@/lib/auth-server';

const ALLOWED_ROLES = ['ADMINISTRADOR', 'SUPERVISOR'];

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let payload: AuthPayload;
  try {
    payload = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (isBlacklisted(payload.jti)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!payload.roles.some((r) => ALLOWED_ROLES.includes(r))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', required_roles: ALLOWED_ROLES },
      { status: 403 },
    );
  }

  const { searchParams } = req.nextUrl;

  const today = todayGMTMinus4();
  const fecha_desde = searchParams.get('fecha_desde') ?? today;
  const fecha_hasta = searchParams.get('fecha_hasta') ?? today;
  const colaborador = searchParams.get('colaborador') || null;
  const tipo_evento = searchParams.get('tipo_evento') || null;
  const dispositivo = searchParams.get('dispositivo') || null;
  const estado = searchParams.get('estado') || null;

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSizeRaw = parseInt(searchParams.get('page_size') ?? '25', 10);
  const page_size = ([25, 50, 100] as number[]).includes(pageSizeRaw) ? pageSizeRaw : 25;

  const { desde, hasta } = buildDateRange(fecha_desde, fecha_hasta);
  const offset = (page - 1) * page_size;

  // Estado computed at query time by joining codigos_colaborador with the current workno mapping.
  const estadoCase = `CASE
    WHEN eb.dispositivo_id IS NULL THEN 'DISPOSITIVO_DESCONOCIDO'
    WHEN cc.colaborador_id IS NOT NULL THEN 'RESUELTO'
    ELSE 'SIN_RESOLVER'
  END`;

  const baseJoins = `
    FROM eventos_biometricos_desglosados ebd
    JOIN eventos_biometricos eb ON eb.id = ebd.evento_id
    LEFT JOIN codigos_colaborador cc
           ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
    LEFT JOIN colaboradores c ON c.id = cc.colaborador_id
  `;

  const baseWhere = `
    WHERE ebd.checktime >= $1
      AND ebd.checktime < $2
      AND ($3::text IS NULL OR
           c.nombre ILIKE '%' || $3 || '%' OR
           c.apellido ILIKE '%' || $3 || '%' OR
           ebd.employee_workno ILIKE '%' || $3 || '%')
      AND ($4::text IS NULL OR ebd.tipo_evento::text = $4)
      AND ($5::text IS NULL OR ebd.device_name = $5)
      AND ($6::text IS NULL OR (${estadoCase}) = $6)
  `;

  const client = await pool.connect();
  try {
    const dataResult = await client.query(
      `SELECT
         ebd.id,
         ebd.checktime,
         ebd.tipo_evento,
         ebd.device_name,
         ebd.employee_workno,
         (${estadoCase}) AS estado_resolucion,
         CASE
           WHEN cc.colaborador_id IS NOT NULL THEN c.nombre || ' ' || c.apellido
           ELSE TRIM(COALESCE(ebd.employee_first_name, '') || ' ' || COALESCE(ebd.employee_last_name, ''))
         END AS display_nombre
       ${baseJoins}
       ${baseWhere}
       ORDER BY ebd.checktime DESC
       LIMIT $7 OFFSET $8`,
      [desde, hasta, colaborador, tipo_evento, dispositivo, estado, page_size, offset],
    );

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count ${baseJoins} ${baseWhere}`,
      [desde, hasta, colaborador, tipo_evento, dispositivo, estado],
    );

    const total = parseInt(countResult.rows[0].count, 10);
    const total_pages = Math.ceil(total / page_size);

    return NextResponse.json({
      eventos: dataResult.rows,
      total,
      page,
      page_size,
      total_pages,
    });
  } finally {
    client.release();
  }
}

function todayGMTMinus4(): string {
  const now = new Date();
  const offset = -4 * 60;
  const local = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  return local.toISOString().slice(0, 10);
}

function buildDateRange(fecha_desde: string, fecha_hasta: string) {
  const desde = new Date(`${fecha_desde}T00:00:00-04:00`);
  const hasta = new Date(`${fecha_hasta}T00:00:00-04:00`);
  hasta.setDate(hasta.getDate() + 1);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}
