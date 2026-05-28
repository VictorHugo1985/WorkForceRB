import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, assertEditable, assertScope, deriveEstadoDia, calcularTotales } from '@/lib/liquidacion-db';

const PatchSchema = z.object({
  horasAjustadasSupervisor: z.number().min(0).optional(),
  motivoAjuste: z.string().optional(),
  descuentoTipo: z.enum(['TARIFA_DIA', 'MONTO_FIJO']).optional(),
  descuentoValor: z.number().positive().optional(),
  descuentoMotivo: z.string().optional(),
  aprobar: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  }
  const dto = parsed.data;

  const client = await pool.connect();
  try {
    const diaRes = await client.query(
      `SELECT d.*, ls.id AS liquidacion_id, ls.colaborador_id
       FROM dias_liquidacion d
       JOIN liquidaciones_semanales ls ON ls.id = d.liquidacion_id
       WHERE d.id = $1`,
      [id],
    );
    if (diaRes.rows.length === 0) {
      return NextResponse.json({ message: 'Día de liquidación no encontrado' }, { status: 404 });
    }
    const dia = diaRes.rows[0];

    await assertEditable(client, dia.liquidacion_id);
    await assertScope(client, userId, roles, dia.colaborador_id);

    const horasAjustadas = dto.horasAjustadasSupervisor !== undefined
      ? dto.horasAjustadasSupervisor
      : dia.horas_ajustadas_supervisor !== null ? Number(dia.horas_ajustadas_supervisor) : null;

    const descuentoTipo = dto.descuentoTipo !== undefined ? dto.descuentoTipo : dia.descuento_tipo;

    const estadoDia = deriveEstadoDia(horasAjustadas, descuentoTipo, dto.aprobar ?? false);

    const sets: string[] = [];
    const queryParams: unknown[] = [id];

    const push = (val: unknown) => { queryParams.push(val); return `$${queryParams.length}`; };

    if (dto.horasAjustadasSupervisor !== undefined) {
      sets.push(`horas_ajustadas_supervisor = ${push(dto.horasAjustadasSupervisor)}`);
      sets.push(`motivo_ajuste = ${push(dto.motivoAjuste ?? null)}`);
    }
    if (dto.descuentoTipo !== undefined) {
      sets.push(`descuento_tipo = ${push(dto.descuentoTipo)}`);
      sets.push(`descuento_valor = ${push(dto.descuentoValor ?? null)}`);
      sets.push(`descuento_motivo = ${push(dto.descuentoMotivo ?? null)}`);
    }
    sets.push(`estado_dia = ${push(estadoDia)}`);

    const updRes = await client.query(
      `UPDATE dias_liquidacion SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      queryParams,
    );

    const totales = await calcularTotales(client, dia.liquidacion_id);
    return NextResponse.json({ dia: updRes.rows[0], totales });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}
