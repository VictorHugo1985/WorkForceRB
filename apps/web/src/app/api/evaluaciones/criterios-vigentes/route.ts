import { NextRequest, NextResponse } from 'next/server';
import { pool, checkRoles } from '@/lib/auth-server';
import { criteriosActivos, ROLES_EVALUACION } from '@/lib/evaluaciones';

export async function GET(req: NextRequest) {
  const auth = await checkRoles(req, ROLES_EVALUACION);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const a = await criteriosActivos(client);
    return NextResponse.json({
      criterios: a.criterios,
      suma_activos: a.sumaTexto,
      configuracion_valida: a.valida,
      config_version: a.version,
    });
  } finally {
    client.release();
  }
}
