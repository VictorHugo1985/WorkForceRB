import { Pool } from 'pg';
import { SignJWT, jwtVerify } from 'jose';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
