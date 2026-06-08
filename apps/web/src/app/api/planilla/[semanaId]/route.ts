import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole } from '@/lib/liquidacion-db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ semanaId: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;

  const { semanaId } = await params;

  const client = await pool.connect();
  try {
    const semanaRes = await client.query(
      `SELECT id, fecha_inicio::text, fecha_fin::text, estado, tipo_periodo
       FROM liquidacion_periodo WHERE id = $1`,
      [semanaId],
    );
    if (semanaRes.rows.length === 0) {
      return NextResponse.json({ error: 'Semana no encontrada' }, { status: 404 });
    }
    const semana = semanaRes.rows[0];
    const fechaInicio = (semana.fecha_inicio as string).slice(0, 10);
    const fechaFin = (semana.fecha_fin as string).slice(0, 10);
    const tipoPeriodo = (semana.tipo_periodo as string | null) ?? null;

    // Collaborators with ≥ 1 punch in the week, filtered by tipo_pago when period has tipo_periodo
    const rosterRes = await client.query(
      `WITH punched AS (
         SELECT cc.colaborador_id,
                COUNT(*) AS punches
         FROM eventos_biometricos_desglosados ebd
         JOIN codigos_colaborador cc
              ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
         WHERE (ebd.checktime AT TIME ZONE 'America/La_Paz')::date BETWEEN $1 AND $2
         GROUP BY cc.colaborador_id, (ebd.checktime AT TIME ZONE 'America/La_Paz')::date
       ),
       colab_max AS (
         SELECT colaborador_id,
                GREATEST(1, CEIL(MAX(punches)::numeric / 2.0)::int) AS max_shifts
         FROM punched
         GROUP BY colaborador_id
       )
       SELECT cm.colaborador_id, cm.max_shifts, c.nombre, c.apellido, c.tarifa_hora
       FROM colab_max cm
       JOIN colaboradores c ON c.id = cm.colaborador_id
       WHERE ($3::text IS NULL OR c.tipo_pago::text = $3)
       ORDER BY c.apellido, c.nombre`,
      [fechaInicio, fechaFin, tipoPeriodo],
    );

    if (rosterRes.rows.length === 0) {
      return NextResponse.json({
        semana: { id: semana.id as string, fechaInicio, fechaFin, estado: semana.estado as string },
        maxShifts: 1,
        colaboradores: [],
      });
    }

    const colaboradorIds: string[] = rosterRes.rows.map((r) => r.colaborador_id as string);
    const maxShifts = Math.max(...rosterRes.rows.map((r) => Number(r.max_shifts)));

    // Ensure borradores exist for all collaborators with punches
    const insertVals = colaboradorIds
      .map((_, i) => `(gen_random_uuid(), $${i * 2 + 1}, $${i * 2 + 2}, 'BORRADOR')`)
      .join(', ');
    await client.query(
      `INSERT INTO liquidacion_colaborador (id, colaborador_id, semana_id, estado)
       VALUES ${insertVals}
       ON CONFLICT (colaborador_id, semana_id) DO NOTHING`,
      colaboradorIds.flatMap((id) => [id, semanaId]),
    );

    const liqRes = await client.query(
      `SELECT id, colaborador_id, estado
       FROM liquidacion_colaborador
       WHERE semana_id = $1 AND colaborador_id = ANY($2::uuid[])`,
      [semanaId, colaboradorIds],
    );
    const liqByColab = new Map<string, { id: string; estado: string }>(
      liqRes.rows.map((r) => [r.colaborador_id as string, { id: r.id as string, estado: r.estado as string }]),
    );

    const colaboradores = rosterRes.rows.map((r) => {
      const liq = liqByColab.get(r.colaborador_id as string);
      return {
        liquidacionId: liq?.id ?? null,
        colaboradorId: r.colaborador_id as string,
        nombre: r.nombre as string,
        apellido: r.apellido as string,
        tarifaHora: r.tarifa_hora !== null ? Number(r.tarifa_hora) : null,
        estado: liq?.estado ?? 'BORRADOR',
      };
    });

    return NextResponse.json({
      semana: { id: semana.id as string, fechaInicio, fechaFin, estado: semana.estado as string },
      maxShifts,
      colaboradores,
    });
  } finally {
    client.release();
  }
}
