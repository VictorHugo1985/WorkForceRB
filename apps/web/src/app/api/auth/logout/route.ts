import { NextRequest, NextResponse } from 'next/server';
import { addToBlacklist, verifyToken, COOKIE_NAME } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (token) {
    try {
      const payload = await verifyToken(token);
      if (payload.jti) addToBlacklist(payload.jti);
    } catch {
      // expired or invalid — clear cookie anyway
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
  return res;
}
