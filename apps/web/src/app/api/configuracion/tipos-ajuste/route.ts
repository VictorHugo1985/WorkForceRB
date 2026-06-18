import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const CreateTipoAjusteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio.').max(100).transform((s) => s.trim()),
});

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, nombre, activo, creado_en FROM tipos_ajuste ORDER BY nombre`,
    );
    return NextResponse.json({ tiposAjuste: result.rows });
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

  const parsed = CreateTipoAjusteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const { nombre } = parsed.data;
  const client = await pool.connect();
  try {
    const dup = await client.query(
      `SELECT id FROM tipos_ajuste WHERE nombre = $1 LIMIT 1`,
      [nombre],
    );
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un tipo de ajuste con ese nombre.' },
        { status: 409 },
      );
    }

    const res = await client.query(
      `INSERT INTO tipos_ajuste (nombre) VALUES ($1) RETURNING id, nombre, activo, creado_en`,
      [nombre],
    );
    return NextResponse.json({ tipoAjuste: res.rows[0] }, { status: 201 });
  } finally {
    client.release();
  }
}
