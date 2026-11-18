import { NextRequest, NextResponse } from 'next/server';
import { pool, verifyToken, isBlacklisted, COOKIE_NAME, AuthPayload } from '@/lib/auth-server';

const ALLOWED_ROLES = ['ADMINISTRADOR', 'SUPERVISOR'];

function todayBolivia(): string {
  const now = new Date();
  const offset = -4 * 60;
  const local = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  return local.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let payload: AuthPayload;
  try {
    payload = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isBlacklisted(payload.jti)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!payload.roles.some((r) => ALLOWED_ROLES.includes(r))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const today = todayBolivia();
  const fechaDesde = searchParams.get('fecha_desde') ?? today;
  const fechaHasta = searchParams.get('fecha_hasta') ?? today;
  const colaborador = searchParams.get('colaborador') || null;
  const dispositivo = searchParams.get('dispositivo') || null;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `WITH eventos AS (
         SELECT
           cc.colaborador_id,
           ((ebd.checktime + make_interval(hours => ebd.utc_offset))::date)::text AS fecha,
           array_agg(
             to_char(ebd.checktime + make_interval(hours => ebd.utc_offset), 'HH24:MI')
             ORDER BY ebd.checktime
           ) AS marcaciones
         FROM eventos_biometricos_desglosados ebd
         JOIN codigos_colaborador cc
              ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
         JOIN colaboradores cf ON cf.id = cc.colaborador_id AND cf.activo = true
         WHERE ((ebd.checktime + make_interval(hours => ebd.utc_offset))::date) BETWEEN $1 AND $2
           AND ($3::text IS NULL OR
                cf.nombre  ILIKE '%' || $3 || '%' OR
                cf.apellido ILIKE '%' || $3 || '%' OR
                cf.cedula   ILIKE '%' || $3 || '%')
           AND ($4::text IS NULL OR ebd.device_serial_number = $4)
         GROUP BY cc.colaborador_id, fecha
       )
       SELECT
         c.id,
         c.nombre,
         c.apellido,
         c.fijo,
         a.id   AS area_id,
         COALESCE(a.nombre, 'Sin área') AS area_nombre,
         COALESCE(
           json_agg(
             json_build_object('fecha', ev.fecha, 'marcaciones', ev.marcaciones)
             ORDER BY ev.fecha
           ) FILTER (WHERE ev.fecha IS NOT NULL),
           '[]'::json
         ) AS dias
       FROM colaboradores c
       LEFT JOIN areas a ON a.id = c.area_id
       LEFT JOIN eventos ev ON ev.colaborador_id = c.id
       WHERE c.activo = true
         AND ($3::text IS NULL OR
              c.nombre  ILIKE '%' || $3 || '%' OR
              c.apellido ILIKE '%' || $3 || '%' OR
              c.cedula   ILIKE '%' || $3 || '%')
       GROUP BY c.id, c.nombre, c.apellido, c.fijo, a.id, a.nombre
       ORDER BY a.nombre NULLS LAST, c.apellido, c.nombre`,
      [fechaDesde, fechaHasta, colaborador, dispositivo],
    );

    // Group by area in JS
    const areaMap = new Map<string, {
      areaId: string | null;
      areaNombre: string;
      colaboradores: unknown[];
    }>();

    for (const row of res.rows) {
      const key = row.area_nombre as string;
      if (!areaMap.has(key)) {
        areaMap.set(key, { areaId: row.area_id ?? null, areaNombre: key, colaboradores: [] });
      }
      areaMap.get(key)!.colaboradores.push({
        id: row.id,
        nombre: row.nombre,
        apellido: row.apellido,
        fijo: row.fijo as boolean,
        dias: row.dias ?? [],
      });
    }

    // FR-015: sort colaboradores by first punch time in single-day view
    if (fechaDesde === fechaHasta) {
      type ColabRow = { apellido: string; nombre: string; dias: Array<{ marcaciones: string[] }> };
      for (const area of areaMap.values()) {
        (area.colaboradores as ColabRow[]).sort((a, b) => {
          const aTime = a.dias[0]?.marcaciones[0];
          const bTime = b.dias[0]?.marcaciones[0];
          if (aTime && bTime) return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
          if (aTime) return -1;
          if (bTime) return 1;
          return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es');
        });
      }
    }

    return NextResponse.json({
      fechaDesde,
      fechaHasta,
      areas: [...areaMap.values()],
    });
  } finally {
    client.release();
  }
}
