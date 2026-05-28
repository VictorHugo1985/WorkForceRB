import { NextRequest } from 'next/server';
import { proxyToNestJS } from '@/lib/api-proxy';

const ALLOWED_ROLES = ['ADMINISTRADOR', 'SUPERVISOR'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToNestJS(req, `/liquidaciones/${id}/aprobar`, ALLOWED_ROLES, { method: 'POST' });
}
