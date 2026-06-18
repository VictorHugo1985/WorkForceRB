import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const PatchTipoPagoSchema = z.object({
  activo: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { codigo } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = PatchTipoPagoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const { activo } = parsed.data;
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT codigo FROM tipos_periodo_pago WHERE codigo = $1`,
      [codigo],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Tipo de período de pago no encontrado.' },
        { status: 404 },
      );
    }

    if (activo === false) {
      const activeCount = await client.query(
        `SELECT COUNT(*) FROM tipos_periodo_pago WHERE activo = true AND codigo != $1`,
        [codigo],
      );
      if (Number(activeCount.rows[0].count) === 0) {
        return NextResponse.json(
          { error: 'Debe existir al menos un tipo de período de pago activo.' },
          { status: 422 },
        );
      }
    }

    const res = await client.query(
      `UPDATE tipos_periodo_pago SET activo = $1 WHERE codigo = $2 RETURNING codigo, nombre, activo`,
      [activo, codigo],
    );
    return NextResponse.json({ tipoPeriodoPago: res.rows[0] });
  } finally {
    client.release();
  }
}
