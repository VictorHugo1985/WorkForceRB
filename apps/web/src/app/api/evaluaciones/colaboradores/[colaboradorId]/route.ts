import { NextRequest, NextResponse } from 'next/server';
import { pool, checkRoles } from '@/lib/auth-server';
import { obtenerHistorial, ROLES_EVALUACION } from '@/lib/evaluaciones';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ colaboradorId: string }> },
) {
  const auth = await checkRoles(req, ROLES_EVALUACION);
  if (auth instanceof NextResponse) return auth;

  const { colaboradorId } = await params;
  const client = await pool.connect();
  try {
    const historial = await obtenerHistorial(client, colaboradorId);
    if (!historial) return NextResponse.json({ error: 'COLABORADOR_NOT_FOUND' }, { status: 404 });
    return NextResponse.json(historial);
  } finally {
    client.release();
  }
}
