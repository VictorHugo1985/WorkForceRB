import { NextRequest } from 'next/server';
import { proxyToNestJS } from '@/lib/api-proxy';

const ALLOWED_ROLES = ['ADMINISTRADOR', 'SUPERVISOR'];

export async function GET(req: NextRequest) {
  return proxyToNestJS(req, '/liquidaciones/resumen', ALLOWED_ROLES);
}
