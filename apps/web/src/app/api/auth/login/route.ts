import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import {
  pool,
  checkBruteForce,
  recordFailure,
  resetBruteForce,
  signToken,
  COOKIE_NAME,
  JWT_TTL_SECONDS,
} from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  let email: string, password: string;
  try {
    ({ email, password } = await req.json());
  } catch {
    return NextResponse.json({ message: 'JSON inválido' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { message: 'Email y contraseña requeridos' },
      { status: 400 },
    );
  }

  const key = email.toLowerCase().trim();
  const ip = req.headers.get('x-forwarded-for') ?? null;

  try {
    checkBruteForce(key);
  } catch (e: any) {
    return NextResponse.json(
      { message: 'Cuenta bloqueada temporalmente', retryAfterSeconds: e.retryAfterSeconds },
      { status: 429 },
    );
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      email: string;
      nombre: string;
      apellido: string;
      password_hash: string;
      activo: boolean;
      debe_cambiar_password: boolean;
      roles: string[];
    }>(
      `SELECT u.id, u.email, u.nombre, u.apellido, u.password_hash,
              u.activo, u.debe_cambiar_password,
              COALESCE(ARRAY_AGG(ur.rol::text) FILTER (WHERE ur.rol IS NOT NULL), ARRAY[]::text[]) AS roles
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       WHERE u.email = $1
       GROUP BY u.id`,
      [key],
    );

    const user = rows[0];

    const deny = async (descripcion: string) => {
      recordFailure(key);
      await client.query(
        `INSERT INTO registros_auditoria
           (usuario_id, accion, entidad_tipo, entidad_id, descripcion, ip_origen)
         VALUES ($1, 'LOGIN_FALLIDO', 'usuario', $2, $3, $4)`,
        [user?.id ?? null, user?.id ?? null, descripcion, ip],
      ).catch(() => {});
      return NextResponse.json({ message: 'Credenciales inválidas' }, { status: 401 });
    };

    if (!user || !user.activo) {
      return deny(`Email no encontrado o usuario inactivo: ${key}`);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return deny('Contraseña incorrecta');
    }

    resetBruteForce(key);

    const jti = randomUUID();
    const fullName = `${user.nombre} ${user.apellido}`;
    const token = await signToken({
      sub: user.id,
      email: user.email,
      nombre: fullName,
      roles: user.roles,
      debeChangiarPassword: user.debe_cambiar_password,
      jti,
    });

    await Promise.allSettled([
      client.query(
        `UPDATE usuarios SET ultimo_acceso = NOW(), actualizado_en = NOW() WHERE id = $1`,
        [user.id],
      ),
      client.query(
        `INSERT INTO registros_auditoria
           (usuario_id, accion, entidad_tipo, entidad_id, descripcion, ip_origen)
         VALUES ($1, 'LOGIN_EXITOSO', 'usuario', $2, 'Inicio de sesión exitoso', $3)`,
        [user.id, user.id, ip],
      ),
    ]);

    const res = NextResponse.json({
      nombre: fullName,
      roles: user.roles,
      debeChangiarPassword: user.debe_cambiar_password,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: JWT_TTL_SECONDS,
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[api/auth/login]', (err as Error).message);
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  } finally {
    client.release();
  }
}
