import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/lib/auth-server';
import { checkLiquidacionRole, assertScope, findOrCreateBorrador, calcularTotales } from '@/lib/liquidacion-db';

const CreateBonoSchema = z.object({
  colaboradorId: z.string().uuid(),
  semanaId: z.string().uuid(),
  fechaDia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: z.enum(['TRANSPORTE', 'ALIMENTACION', 'GENERICO']),
  monto: z.number().positive(),
  comentario: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId, roles } = auth;

  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }

  const parsed = CreateBonoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  }
  const dto = parsed.data;

  const client = await pool.connect();
  try {
    await assertScope(client, userId, roles, dto.colaboradorId);

    const liquidacionId = await findOrCreateBorrador(client, dto.colaboradorId, dto.semanaId);

    const res = await client.query(
      `INSERT INTO bonos (id, colaborador_id, semana_id, fecha_dia, tipo, monto, comentario, aprobado_por, creado_en)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [dto.colaboradorId, dto.semanaId, dto.fechaDia, dto.tipo, dto.monto, dto.comentario, userId],
    );

    const totales = await calcularTotales(client, liquidacionId);
    return NextResponse.json({ bono: res.rows[0], totales }, { status: 201 });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status) return NextResponse.json({ message: e.message }, { status: e.status });
    throw err;
  } finally {
    client.release();
  }
}
