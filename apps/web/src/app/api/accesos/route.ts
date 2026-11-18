import { NextRequest, NextResponse } from 'next/server';
import { pool, checkAdminRole } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const usuarioId = searchParams.get('usuario_id');
  const resultado = searchParams.get('resultado');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [`ra.accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')`];
  const params: unknown[] = [];

  if (usuarioId) {
    params.push(usuarioId);
    conditions.push(`ra.usuario_id = $${params.length}`);
  }
  if (resultado === 'exitoso') {
    conditions.push(`ra.accion = 'LOGIN_EXITOSO'`);
  } else if (resultado === 'fallido') {
    conditions.push(`ra.accion = 'LOGIN_FALLIDO'`);
  }
  if (desde) {
    params.push(desde);
    conditions.push(`ra.creado_en >= $${params.length}::date`);
  }
  if (hasta) {
    params.push(hasta);
    conditions.push(`ra.creado_en < $${params.length}::date + interval '1 day'`);
  }

  const where = conditions.join(' AND ');

  const client = await pool.connect();
  try {
    const [dataRes, countRes] = await Promise.all([
      client.query(
        `SELECT
           ra.id,
           ra.creado_en,
           CASE ra.accion WHEN 'LOGIN_EXITOSO' THEN 'exitoso' ELSE 'fallido' END AS resultado,
           ra.ip_origen,
           ra.descripcion,
           ra.usuario_id,
           u.nombre   AS usuario_nombre,
           u.apellido AS usuario_apellido,
           u.email    AS usuario_email
         FROM registros_auditoria ra
         LEFT JOIN usuarios u ON u.id = ra.usuario_id
         WHERE ${where}
         ORDER BY ra.creado_en DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      client.query(
        `SELECT COUNT(*) AS total
         FROM registros_auditoria ra
         WHERE ${where}`,
        params,
      ),
    ]);

    return NextResponse.json({
      total: parseInt(countRes.rows[0].total, 10),
      page,
      limit,
      accesos: dataRes.rows.map((r) => ({
        id: r.id,
        creado_en: r.creado_en,
        resultado: r.resultado,
        ip_origen: r.ip_origen ?? null,
        descripcion: r.descripcion ?? null,
        usuario_id: r.usuario_id ?? null,
        usuario_nombre: r.usuario_nombre
          ? `${r.usuario_nombre} ${r.usuario_apellido}`
          : null,
        usuario_email: r.usuario_email ?? null,
      })),
    });
  } finally {
    client.release();
  }
}
