import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole, verifyToken, isBlacklisted, COOKIE_NAME } from '@/lib/auth-server';

const CreateSchema = z.object({
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
});

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const payload = await verifyToken(token);
    if (isBlacklisted(payload.jti)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    if (!payload.roles.includes('ADMINISTRADOR') && !payload.roles.includes('SUPERVISOR')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, fecha_inicio, fecha_fin, estado, creado_en FROM semanas_laborales ORDER BY fecha_inicio DESC`,
    );
    return NextResponse.json(res.rows);
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  }

  const { fechaInicio, fechaFin } = parsed.data;
  if (fechaFin < fechaInicio) {
    return NextResponse.json({ message: 'La fecha fin debe ser posterior al inicio' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const dup = await client.query(
      `SELECT id FROM semanas_laborales WHERE fecha_inicio = $1 LIMIT 1`,
      [fechaInicio],
    );
    if (dup.rows.length > 0) {
      return NextResponse.json({ message: 'Ya existe un período con esa fecha de inicio' }, { status: 409 });
    }

    const res = await client.query(
      `INSERT INTO semanas_laborales (id, fecha_inicio, fecha_fin, estado, creado_en)
       VALUES (gen_random_uuid(), $1, $2, 'ABIERTA', now())
       RETURNING id, fecha_inicio, fecha_fin, estado, creado_en`,
      [fechaInicio, fechaFin],
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } finally {
    client.release();
  }
}
