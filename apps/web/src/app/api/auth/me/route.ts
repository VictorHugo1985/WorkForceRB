import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  verifyToken,
  isBlacklisted,
  signToken,
  COOKIE_NAME,
  JWT_TTL_SECONDS,
} from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: 'No autenticado' }, { status: 401 });
  }

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    return NextResponse.json({ message: 'Token inválido o expirado' }, { status: 401 });
  }

  if (isBlacklisted(payload.jti)) {
    return NextResponse.json({ message: 'Sesión cerrada' }, { status: 401 });
  }

  const res = NextResponse.json({
    nombre: payload.nombre,
    email: payload.email,
    roles: payload.roles,
    debeChangiarPassword: payload.debeChangiarPassword,
  });

  // Sliding window: renew token if less than 1 hour remaining
  const remainingSeconds = payload.exp - Math.floor(Date.now() / 1000);
  if (remainingSeconds < 3600) {
    const newToken = await signToken({
      sub: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      roles: payload.roles,
      debeChangiarPassword: payload.debeChangiarPassword,
      jti: randomUUID(),
    });
    res.cookies.set(COOKIE_NAME, newToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: JWT_TTL_SECONDS,
      path: '/',
    });
  }

  return res;
}
