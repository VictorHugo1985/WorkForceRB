import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { SignJWT, jwtVerify } from 'jose';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,                      // serverless: each instance needs very few connections
  idleTimeoutMillis: 10_000,   // release idle connections quickly
  connectionTimeoutMillis: 5_000,
});

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'workforce-jwt-secret-change-in-production',
);

export const COOKIE_NAME = 'access_token';
export const JWT_TTL_SECONDS = 7200;

export interface AuthPayload {
  sub: string;
  email: string;
  nombre: string;
  roles: string[];
  debeChangiarPassword: boolean;
  jti: string;
  iat: number;
  exp: number;
}

// In-memory brute-force state (per process — acceptable for MVP)
const bruteMap = new Map<string, { count: number; lockedUntil: number }>();
// In-memory JTI blacklist (per process — acceptable for MVP)
const blacklist = new Set<string>();

export function checkBruteForce(key: string): void {
  const entry = bruteMap.get(key);
  if (!entry) return;
  if (entry.lockedUntil > Date.now()) {
    const retryAfterSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    const err: any = new Error('locked');
    err.statusCode = 429;
    err.retryAfterSeconds = retryAfterSeconds;
    throw err;
  }
}

export function recordFailure(key: string): void {
  const entry = bruteMap.get(key) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.lockedUntil = Date.now() + 15 * 60 * 1000;
    entry.count = 0;
  }
  bruteMap.set(key, entry);
}

export function resetBruteForce(key: string): void {
  bruteMap.delete(key);
}

export function addToBlacklist(jti: string): void {
  blacklist.add(jti);
}

export function isBlacklisted(jti: string): boolean {
  return blacklist.has(jti);
}

export async function signToken(
  payload: Omit<AuthPayload, 'iat' | 'exp'>,
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    nombre: payload.nombre,
    roles: payload.roles,
    debeChangiarPassword: payload.debeChangiarPassword,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setJti(payload.jti)
    .setIssuedAt()
    .setExpirationTime(`${JWT_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as AuthPayload;
}

export async function checkSessionValidity(userId: string, iat: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT roles_actualizados_en FROM usuarios WHERE id = $1 AND activo = true`,
      [userId],
    );
    if (res.rows.length === 0) return false;
    const ts: Date | null = res.rows[0].roles_actualizados_en;
    if (!ts) return true;
    return iat * 1000 > new Date(ts).getTime();
  } finally {
    client.release();
  }
}

/**
 * Verifica token, revocación, rol (al menos uno de `roles`) y validez de sesión.
 * Devuelve el usuario autenticado o la respuesta de error lista para retornar.
 */
export async function checkRoles(
  req: NextRequest,
  roles: string[],
): Promise<{ userId: string; roles: string[] } | NextResponse> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  let payload: AuthPayload;
  try {
    payload = await verifyToken(token);
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isBlacklisted(payload.jti)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const userRoles = payload.roles ?? [];
  if (!userRoles.some((r) => roles.includes(r))) {
    return NextResponse.json(
      { error: 'FORBIDDEN', required_roles: roles },
      { status: 403 },
    );
  }
  let sessionValid: boolean;
  try {
    sessionValid = await checkSessionValidity(payload.sub, payload.iat);
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!sessionValid) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  return { userId: payload.sub, roles: userRoles };
}

export async function checkAdminRole(
  req: NextRequest,
): Promise<{ userId: string } | NextResponse> {
  const result = await checkRoles(req, ['ADMINISTRADOR']);
  if (result instanceof NextResponse) {
    if (result.status === 403) {
      return NextResponse.json(
        { error: 'FORBIDDEN', required_role: 'ADMINISTRADOR' },
        { status: 403 },
      );
    }
    return result;
  }
  return { userId: result.userId };
}

/**
 * Guard para server components: valida la cookie de sesión y que el usuario tenga
 * al menos uno de los roles permitidos. Redirige a /login o /dashboard si no.
 */
export async function requirePageRoles(allowed: string[]): Promise<AuthPayload> {
  const { cookies } = await import('next/headers');
  const { redirect } = await import('next/navigation');
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) redirect('/login?reason=expired');
  let payload: AuthPayload;
  try {
    payload = await verifyToken(token!);
  } catch {
    redirect('/login?reason=expired');
  }
  if (isBlacklisted(payload!.jti)) redirect('/login?reason=expired');
  if (!payload!.roles.some((r) => allowed.includes(r))) redirect('/dashboard');
  return payload!;
}
