import { NextRequest, NextResponse } from 'next/server';
import { pool, checkRoles } from '@/lib/auth-server';
import { fetchEvaluacionDetalle, ROLES_EVALUACION } from '@/lib/evaluaciones';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkRoles(req, ROLES_EVALUACION);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const evaluacion = await fetchEvaluacionDetalle(client, id);
    if (!evaluacion) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ evaluacion });
  } finally {
    client.release();
  }
}
