import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkRoles } from '@/lib/auth-server';
import { generarReporte, ROLES_HORAS } from '@/lib/horas-trabajadas';

const QuerySchema = z.object({
  periodo: z.enum(['trimestre', 'semestre', 'anio'], { message: 'Período inválido.' }).default('trimestre'),
});

export async function GET(req: NextRequest) {
  const auth = await checkRoles(req, ROLES_HORAS);
  if (auth instanceof NextResponse) return auth;

  const parsed = QuerySchema.safeParse({ periodo: req.nextUrl.searchParams.get('periodo') ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const client = await pool.connect();
  try {
    return NextResponse.json(await generarReporte(client, parsed.data.periodo));
  } finally {
    client.release();
  }
}
