import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const CreateAreaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.').max(100).transform((s) => s.trim()),
});

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, nombre, activo, creado_en FROM areas ORDER BY nombre`,
    );
    return NextResponse.json({ areas: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = CreateAreaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.success ? '' : parsed.error.issues[0].message },
      { status: 422 },
    );
  }

  const { nombre } = parsed.data;
  const client = await pool.connect();
  try {
    const dup = await client.query(`SELECT id FROM areas WHERE nombre = $1 LIMIT 1`, [nombre]);
    if (dup.rows.length > 0) {
      return NextResponse.json({ error: 'Ya existe un área con ese nombre.' }, { status: 409 });
    }

    const res = await client.query(
      `INSERT INTO areas (nombre) VALUES ($1) RETURNING id, nombre, activo, creado_en`,
      [nombre],
    );
    return NextResponse.json({ area: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
