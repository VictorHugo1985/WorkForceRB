import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { LiquidacionesListClient } from '@/components/liquidaciones/LiquidacionesListClient';

export default async function LiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ semana_id?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  let userId = '';
  let roles: string[] = [];
  try {
    const payload = await verifyToken(token!);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
    userId = payload.sub;
    roles = payload.roles;
  } catch {
    redirect('/login?reason=expired');
  }

  const { semana_id } = await searchParams;
  const isSupervisorOnly = roles.includes('SUPERVISOR') && !roles.includes('ADMINISTRADOR');

  let semanaActiva: { id: string; fecha_inicio: string; fecha_fin: string; estado: string } | null = null;
  let liquidaciones: {
    colaboradorId: string; colaboradorNombre: string; colaboradorApellido: string;
    area: string | null; liquidacionId: string | null; estado: string | null; totalPago: number | null;
  }[] = [];
  let semanas: { id: string; fecha_inicio: string; fecha_fin: string; estado: string }[] = [];

  try {
    const client = await pool.connect();
    try {
      let semanaId = semana_id ?? null;

      if (!semanaId) {
        const r = await client.query(
          `SELECT id FROM semanas_laborales WHERE estado = 'ABIERTA' ORDER BY fecha_inicio DESC LIMIT 1`,
        );
        semanaId = r.rows[0]?.id ?? null;
      }

      if (semanaId) {
        const semanaRes = await client.query(
          `SELECT id, fecha_inicio, fecha_fin, estado FROM semanas_laborales WHERE id = $1`,
          [semanaId],
        );
        semanaActiva = semanaRes.rows[0] ?? null;

        if (semanaActiva) {
          const colabRes = await client.query(
            `SELECT c.id, c.nombre, c.apellido, a.nombre AS area_nombre,
                    ls.id AS liq_id, ls.estado AS liq_estado, ls.total_pago
             FROM colaboradores c
             LEFT JOIN areas a ON a.id = c.area_id
             LEFT JOIN liquidaciones_semanales ls ON ls.colaborador_id = c.id AND ls.semana_id = $1
             WHERE c.activo = true ${isSupervisorOnly ? 'AND c.supervisor_id = $2' : ''}
             ORDER BY c.apellido, c.nombre`,
            isSupervisorOnly ? [semanaId, userId] : [semanaId],
          );
          liquidaciones = colabRes.rows.map((r) => ({
            colaboradorId: r.id,
            colaboradorNombre: r.nombre,
            colaboradorApellido: r.apellido,
            area: r.area_nombre ?? null,
            liquidacionId: r.liq_id ?? null,
            estado: r.liq_estado ?? null,
            totalPago: r.total_pago !== null ? Number(r.total_pago) : null,
          }));
        }
      }

      const semanasRes = await client.query(
        `SELECT id, fecha_inicio, fecha_fin, estado FROM semanas_laborales ORDER BY fecha_inicio DESC`,
      );
      semanas = semanasRes.rows;
    } finally {
      client.release();
    }
  } catch {
    /* show empty state */
  }

  return (
    <LiquidacionesListClient
      semanaActiva={semanaActiva}
      semanas={semanas}
      liquidaciones={liquidaciones}
    />
  );
}
