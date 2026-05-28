import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole } from '@/lib/liquidacion-db';

export async function GET(req: NextRequest) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  const isSupervisorOnly = roles.includes('SUPERVISOR') && !roles.includes('ADMINISTRADOR');
  const client = await pool.connect();
  try {
    let semanaId = req.nextUrl.searchParams.get('semana_id');

    if (!semanaId) {
      const r = await client.query(
        `SELECT id FROM semanas_laborales WHERE estado = 'ABIERTA' ORDER BY fecha_inicio DESC LIMIT 1`,
      );
      if (r.rows.length === 0) return NextResponse.json({ semana: null, liquidaciones: [] });
      semanaId = r.rows[0].id as string;
    }

    const semanaRes = await client.query(
      `SELECT id, fecha_inicio, fecha_fin, estado FROM semanas_laborales WHERE id = $1`,
      [semanaId],
    );
    if (semanaRes.rows.length === 0) return NextResponse.json({ semana: null, liquidaciones: [] });
    const semana = semanaRes.rows[0];

    const colaboradoresRes = await client.query(
      `SELECT c.id, c.nombre, c.apellido, a.nombre AS area_nombre,
              ls.id AS liq_id, ls.estado AS liq_estado, ls.total_pago
       FROM colaboradores c
       LEFT JOIN areas a ON a.id = c.area_id
       LEFT JOIN liquidaciones_semanales ls ON ls.colaborador_id = c.id AND ls.semana_id = $1
       WHERE c.activo = true ${isSupervisorOnly ? 'AND c.supervisor_id = $2' : ''}
       ORDER BY c.apellido, c.nombre`,
      isSupervisorOnly ? [semanaId, userId] : [semanaId],
    );

    const liquidaciones = colaboradoresRes.rows.map((r) => ({
      colaboradorId: r.id,
      colaboradorNombre: r.nombre,
      colaboradorApellido: r.apellido,
      area: r.area_nombre ?? null,
      liquidacionId: r.liq_id ?? null,
      estado: r.liq_estado ?? null,
      totalPago: r.total_pago !== null ? Number(r.total_pago) : null,
    }));

    return NextResponse.json({ semana, liquidaciones });
  } finally {
    client.release();
  }
}
