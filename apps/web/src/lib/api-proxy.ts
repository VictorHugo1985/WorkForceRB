import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, isBlacklisted, COOKIE_NAME } from './auth-server';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export async function proxyToNestJS(
  req: NextRequest,
  nestPath: string,
  allowedRoles: string[],
  options?: { method?: string; body?: unknown },
): Promise<NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (isBlacklisted(payload.jti)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!payload.roles.some((r) => allowedRoles.includes(r))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const searchParams = req.nextUrl.searchParams.toString();
  const url = `${API_URL}${nestPath}${searchParams ? `?${searchParams}` : ''}`;

  const method = options?.method ?? req.method ?? 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const fetchInit: RequestInit = { method, headers };
  if (options?.body) {
    fetchInit.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, fetchInit);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 });
  }
}
