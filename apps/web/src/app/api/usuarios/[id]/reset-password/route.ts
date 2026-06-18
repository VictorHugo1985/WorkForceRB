import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool, checkAdminRole } from '@/lib/auth-server';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const ResetSchema = z.object({
  password: z.string().refine((p) => PASSWORD_REGEX.test(p), {
    message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
  }),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { password } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, activo FROM usuarios WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!existing.rows[0].activo) {
      return NextResponse.json(
        { error: 'INACTIVE', message: 'No se puede resetear la contraseña de una cuenta inactiva.' },
        { status: 422 },
      );
    }

    const hash = await bcrypt.hash(password, 10);

    await client.query(
      `UPDATE usuarios SET password_hash = $1, debe_cambiar_password = true, actualizado_en = NOW() WHERE id = $2`,
      [hash, id],
    );

    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id)
         VALUES ('USUARIO_PASSWORD_RESETEADA', 'Usuario', $1, $2)`,
        [id, userId],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({ ok: true });
  } finally {
    client.release();
  }
}
