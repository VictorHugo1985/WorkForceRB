import { NextRequest } from 'next/server';
import { proxyToNestJS } from '@/lib/api-proxy';

const ALLOWED_ROLES = ['ADMINISTRADOR', 'SUPERVISOR'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return proxyToNestJS(req, `/dias-liquidacion/${id}`, ALLOWED_ROLES, {
    method: 'PATCH',
    body,
  });
}
