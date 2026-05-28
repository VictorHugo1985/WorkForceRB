import { NextRequest } from 'next/server';
import { proxyToNestJS } from '@/lib/api-proxy';

const ADMIN_ONLY = ['ADMINISTRADOR'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyToNestJS(req, `/semanas-laborales/${id}/cerrar`, ADMIN_ONLY, { method: 'PATCH' });
}
