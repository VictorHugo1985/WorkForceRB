import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkRoles } from '@/lib/auth-server';
import { generarReporte, ROLES_HORAS } from '@/lib/horas-trabajadas';

const QuerySchema = z.object({
  periodo: z.enum(['trimestre', 'semestre', 'anio'], { message: 'Período inválido.' }).default('trimestre'),
  agrupacion: z.enum(['mes', 'semana'], { message: 'Agrupación inválida.' }).default('mes'),
});

export async function GET(req: NextRequest) {
  const auth = await checkRoles(req, ROLES_HORAS);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    periodo: sp.get('periodo') ?? undefined,
    agrupacion: sp.get('agrupacion') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const client = await pool.connect();
  try {
    const reporte = await generarReporte(client, parsed.data.periodo, parsed.data.agrupacion);
    return NextResponse.json(reporte);
  } finally {
    client.release();
  }
}
