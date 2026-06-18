import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool, checkAdminRole } from '@/lib/auth-server';

const ROLES_VALIDOS = ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'] as const;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const CreateUsuarioSchema = z.object({
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  email: z.string().email(),
  roles: z.array(z.enum(ROLES_VALIDOS)).min(1),
  password: z.string().refine((p) => PASSWORD_REGEX.test(p), {
    message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
  }),
  colaborador_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.colaborador_id, u.creado_en,
              COALESCE(
                json_agg(ur.rol ORDER BY ur.rol) FILTER (WHERE ur.rol IS NOT NULL),
                '[]'
              ) AS roles,
              c.nombre AS colaborador_nombre, c.apellido AS colaborador_apellido
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN colaboradores c ON c.id = u.colaborador_id
       GROUP BY u.id, u.nombre, u.apellido, u.email, u.activo, u.colaborador_id, u.creado_en,
                c.nombre, c.apellido
       ORDER BY u.apellido, u.nombre`,
    );

    return NextResponse.json(
      res.rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        apellido: r.apellido,
        email: r.email,
        activo: r.activo,
        roles: r.roles,
        colaborador_id: r.colaborador_id ?? null,
        colaborador_nombre: r.colaborador_nombre
          ? `${r.colaborador_nombre} ${r.colaborador_apellido}`
          : null,
        creado_en: r.creado_en,
      })),
    );
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = CreateUsuarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { nombre, apellido, email, roles, password, colaborador_id } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  const client = await pool.connect();
  try {
    const dupEmail = await client.query(
      `SELECT id FROM usuarios WHERE email = $1 LIMIT 1`,
      [emailNorm],
    );
    if (dupEmail.rows.length > 0) {
      return NextResponse.json(
        { error: 'DUPLICATE_EMAIL', message: 'Ya existe una cuenta con ese correo electrónico.' },
        { status: 409 },
      );
    }

    if (colaborador_id) {
      const dupColaborador = await client.query(
        `SELECT id FROM usuarios WHERE colaborador_id = $1 LIMIT 1`,
        [colaborador_id],
      );
      if (dupColaborador.rows.length > 0) {
        return NextResponse.json(
          { error: 'COLABORADOR_ALREADY_LINKED', message: 'Ese colaborador ya está vinculado a otra cuenta.' },
          { status: 409 },
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userRes = await client.query<{ id: string }>(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido, debe_cambiar_password, activo, colaborador_id)
       VALUES ($1, $2, $3, $4, true, true, $5)
       RETURNING id`,
      [emailNorm, passwordHash, nombre, apellido, colaborador_id ?? null],
    );
    const newId = userRes.rows[0].id;

    for (const rol of roles) {
      await client.query(
        `INSERT INTO usuario_roles (usuario_id, rol) VALUES ($1, $2)`,
        [newId, rol],
      );
    }

    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, datos_nuevos)
         VALUES ('USUARIO_CREADO', 'Usuario', $1, $2, $3)`,
        [newId, userId, JSON.stringify({ email: emailNorm, nombre, apellido, roles, colaborador_id: colaborador_id ?? null })],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json(
      { id: newId, nombre, apellido, email: emailNorm, roles, activo: true, colaborador_id: colaborador_id ?? null },
      { status: 201 },
    );
  } finally {
    client.release();
  }
}
