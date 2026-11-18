import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const PatchSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  apellido: z.string().min(1).max(100).optional(),
  colaborador_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT u.id, u.nombre, u.apellido, u.email, u.activo, u.colaborador_id, u.creado_en, u.ultimo_acceso,
              COALESCE(
                json_agg(ur.rol ORDER BY ur.rol) FILTER (WHERE ur.rol IS NOT NULL),
                '[]'
              ) AS roles,
              c.nombre AS colaborador_nombre, c.apellido AS colaborador_apellido
       FROM usuarios u
       LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
       LEFT JOIN colaboradores c ON c.id = u.colaborador_id
       WHERE u.id = $1
       GROUP BY u.id, u.nombre, u.apellido, u.email, u.activo, u.colaborador_id,
                u.creado_en, u.ultimo_acceso, c.nombre, c.apellido`,
      [id],
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const r = res.rows[0];
    return NextResponse.json({
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
      ultimo_acceso: r.ultimo_acceso ?? null,
    });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { nombre, apellido, colaborador_id } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id FROM usuarios WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }

    if (colaborador_id !== undefined && colaborador_id !== null) {
      const dupColaborador = await client.query(
        `SELECT id FROM usuarios WHERE colaborador_id = $1 AND id != $2 LIMIT 1`,
        [colaborador_id, id],
      );
      if (dupColaborador.rows.length > 0) {
        return NextResponse.json(
          { error: 'COLABORADOR_ALREADY_LINKED', message: 'Ese colaborador ya está vinculado a otra cuenta.' },
          { status: 409 },
        );
      }
    }

    const setParts: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (nombre !== undefined) { setParts.push(`nombre = $${idx++}`); values.push(nombre); }
    if (apellido !== undefined) { setParts.push(`apellido = $${idx++}`); values.push(apellido); }
    if (colaborador_id !== undefined) { setParts.push(`colaborador_id = $${idx++}`); values.push(colaborador_id); }

    if (setParts.length === 0) {
      return NextResponse.json({ message: 'Sin cambios' });
    }

    setParts.push(`actualizado_en = NOW()`);
    values.push(id);

    await client.query(
      `UPDATE usuarios SET ${setParts.join(', ')} WHERE id = $${idx}`,
      values,
    );

    return NextResponse.json({ id, nombre, apellido, colaborador_id: colaborador_id ?? null });
  } finally {
    client.release();
  }
}
