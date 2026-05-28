import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, assertEditable, assertScope, calcularTotales } from '@/lib/liquidacion-db';

const PatchBonoSchema = z.object({
  monto: z.number().positive().optional(),
  comentario: z.string().min(1).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }

  const parsed = PatchBonoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  }
  const dto = parsed.data;

  const client = await pool.connect();
  try {
    const bonoRes = await client.query(
      `SELECT b.*, ls.id AS liquidacion_id FROM bonos b
       LEFT JOIN liquidaciones_semanales ls ON ls.colaborador_id = b.colaborador_id AND ls.semana_id = b.semana_id
       WHERE b.id = $1`,
      [id],
    );
    if (bonoRes.rows.length === 0) {
      return NextResponse.json({ message: 'Bono no encontrado' }, { status: 404 });
    }
    const bono = bonoRes.rows[0];

    if (bono.liquidacion_id) await assertEditable(client, bono.liquidacion_id);
    await assertScope(client, userId, roles, bono.colaborador_id);

    const sets: string[] = [];
    const queryParams: unknown[] = [id];
    const push = (val: unknown) => { queryParams.push(val); return `$${queryParams.length}`; };

    if (dto.monto !== undefined) sets.push(`monto = ${push(dto.monto)}`);
    if (dto.comentario !== undefined) sets.push(`comentario = ${push(dto.comentario)}`);

    if (sets.length === 0) {
      return NextResponse.json({ message: 'No hay campos para actualizar' }, { status: 400 });
    }

    const updRes = await client.query(
      `UPDATE bonos SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      queryParams,
    );

    let totales = null;
    if (bono.liquidacion_id) {
      totales = await calcularTotales(client, bono.liquidacion_id);
    }

    return NextResponse.json({ bono: updRes.rows[0], totales });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  const { id } = await params;

  const client = await pool.connect();
  try {
    const bonoRes = await client.query(
      `SELECT b.*, ls.id AS liquidacion_id FROM bonos b
       LEFT JOIN liquidaciones_semanales ls ON ls.colaborador_id = b.colaborador_id AND ls.semana_id = b.semana_id
       WHERE b.id = $1`,
      [id],
    );
    if (bonoRes.rows.length === 0) {
      return NextResponse.json({ message: 'Bono no encontrado' }, { status: 404 });
    }
    const bono = bonoRes.rows[0];

    if (bono.liquidacion_id) await assertEditable(client, bono.liquidacion_id);
    await assertScope(client, userId, roles, bono.colaborador_id);

    await client.query(`DELETE FROM bonos WHERE id = $1`, [id]);

    let totales = null;
    if (bono.liquidacion_id) {
      totales = await calcularTotales(client, bono.liquidacion_id);
    }

    return NextResponse.json({ totales });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}
