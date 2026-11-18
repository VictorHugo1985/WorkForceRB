import { NextRequest, NextResponse } from 'next/server';
import { pool, checkRoles } from '@/lib/auth-server';
import { listarColaboradoresEvaluacion, ROLES_EVALUACION } from '@/lib/evaluaciones';

export async function GET(req: NextRequest) {
  const auth = await checkRoles(req, ROLES_EVALUACION);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const limit = parseInt(searchParams.get('limit') ?? '50', 10) || 50;

  const client = await pool.connect();
  try {
    const data = await listarColaboradoresEvaluacion(client, {
      q: searchParams.get('q'),
      incluirInactivos: searchParams.get('incluir_inactivos') === 'true',
      page,
      limit,
    });
    return NextResponse.json(data);
  } finally {
    client.release();
  }
}
