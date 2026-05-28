import { NextRequest } from 'next/server';
import { proxyToNestJS } from '@/lib/api-proxy';

const ALLOWED_ROLES = ['ADMINISTRADOR', 'SUPERVISOR'];
const ADMIN_ONLY = ['ADMINISTRADOR'];

export async function GET(req: NextRequest) {
  return proxyToNestJS(req, '/semanas-laborales', ALLOWED_ROLES);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  return proxyToNestJS(req, '/semanas-laborales', ADMIN_ONLY, { method: 'POST', body });
}
