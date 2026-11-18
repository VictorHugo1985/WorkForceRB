import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkRoles } from '@/lib/auth-server';
import {
  diffDays,
  generarDetalle,
  MAX_DIAS_DETALLE,
  ROLES_HORAS,
  todayGMTMinus4,
} from '@/lib/horas-trabajadas';

const fecha = z
  .string({ message: 'Fecha requerida.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Fecha inválida.');

const QuerySchema = z
  .object({
    colaborador_id: z.string({ message: 'Colaborador requerido.' }).uuid('Colaborador inválido.'),
    desde: fecha,
    hasta: fecha,
  })
  .refine((q) => q.desde <= q.hasta, { message: 'La fecha "desde" debe ser anterior o igual a "hasta".' })
  .refine((q) => q.hasta <= todayGMTMinus4(), { message: 'La fecha "hasta" no puede ser futura.' })
  .refine((q) => diffDays(q.desde, q.hasta) < MAX_DIAS_DETALLE, {
    message: `El rango no puede superar ${MAX_DIAS_DETALLE} días.`,
  });

export async function GET(req: NextRequest) {
  const auth = await checkRoles(req, ROLES_HORAS);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    colaborador_id: sp.get('colaborador_id') ?? undefined,
    desde: sp.get('desde') ?? undefined,
    hasta: sp.get('hasta') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }
  const { colaborador_id, desde, hasta } = parsed.data;

  const client = await pool.connect();
  try {
    const col = await client.query(
      `SELECT id, nombre, apellido FROM colaboradores WHERE id = $1`,
      [colaborador_id],
    );
    if (col.rows.length === 0) {
      return NextResponse.json({ error: 'COLABORADOR_NOT_FOUND' }, { status: 404 });
    }
    const detalle = await generarDetalle(client, colaborador_id, desde, hasta);
    return NextResponse.json({ colaborador: col.rows[0], desde, hasta, ...detalle });
  } finally {
    client.release();
  }
}
