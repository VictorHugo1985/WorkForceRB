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

  const client = await pool.connect();
  try {
    const dataResult = await client.query(
      `SELECT
         eb.id,
         eb.estado_resolucion,
         ebd.checktime,
         ebd.tipo_evento,
         ebd.device_name,
         ebd.employee_workno,
         CASE
           WHEN eb.colaborador_id IS NOT NULL THEN c.nombre
           ELSE TRIM(COALESCE(ebd.employee_first_name, '') || ' ' || COALESCE(ebd.employee_last_name, ''))
         END AS display_nombre,
         CASE
           WHEN eb.colaborador_id IS NOT NULL THEN c.cedula
           ELSE ebd.employee_workno
         END AS display_identificador
       FROM eventos_biometricos eb
       LEFT JOIN eventos_biometricos_desglosados ebd ON eb.id = ebd.evento_id
       LEFT JOIN colaboradores c ON eb.colaborador_id = c.id
       WHERE ebd.checktime >= $1
         AND ebd.checktime < $2
         AND ($3::text IS NULL OR
              c.nombre ILIKE '%' || $3 || '%' OR
              c.cedula ILIKE '%' || $3 || '%' OR
              ebd.employee_workno ILIKE '%' || $3 || '%')
         AND ($4::text IS NULL OR ebd.tipo_evento::text = $4)
         AND ($5::text IS NULL OR ebd.device_name = $5)
         AND ($6::text IS NULL OR eb.estado_resolucion::text = $6)
       ORDER BY ebd.checktime DESC
       LIMIT $7 OFFSET $8`,
      [desde, hasta, colaborador, tipo_evento, dispositivo, estado, page_size, offset],
    );

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM eventos_biometricos eb
       LEFT JOIN eventos_biometricos_desglosados ebd ON eb.id = ebd.evento_id
       LEFT JOIN colaboradores c ON eb.colaborador_id = c.id
       WHERE ebd.checktime >= $1
         AND ebd.checktime < $2
         AND ($3::text IS NULL OR
              c.nombre ILIKE '%' || $3 || '%' OR
              c.cedula ILIKE '%' || $3 || '%' OR
              ebd.employee_workno ILIKE '%' || $3 || '%')
         AND ($4::text IS NULL OR ebd.tipo_evento::text = $4)
         AND ($5::text IS NULL OR ebd.device_name = $5)
         AND ($6::text IS NULL OR eb.estado_resolucion::text = $6)`,
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
