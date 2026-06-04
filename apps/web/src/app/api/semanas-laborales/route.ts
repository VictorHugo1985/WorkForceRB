import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, verifyToken, isBlacklisted, COOKIE_NAME } from '@/lib/auth-server';
import { checkLiquidacionRole, generarBorradoresSemana } from '@/lib/liquidacion-db';

const TIPO_PERIODO = ['SEMANAL', 'QUINCENAL', 'MENSUAL'] as const;

const CreateSchema = z.object({
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  tipoPeriodo: z.enum(TIPO_PERIODO).optional(),
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
      `SELECT sl.id, sl.fecha_inicio, sl.fecha_fin, sl.estado, sl.tipo_periodo, sl.creado_en,
              sl.cerrada_en, sl.monto_total_pagado, sl.cantidad_colaboradores_pagados,
              uc.nombre AS creado_por_nombre, uc.apellido AS creado_por_apellido,
              ux.nombre AS cerrado_por_nombre, ux.apellido AS cerrado_por_apellido
       FROM semanas_laborales sl
       LEFT JOIN usuarios uc ON uc.id = sl.creado_por
       LEFT JOIN usuarios ux ON ux.id = sl.cerrada_por
       ORDER BY sl.fecha_inicio DESC`,
    );
    return NextResponse.json(res.rows.map((r) => ({
      id: r.id,
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      estado: r.estado,
      tipo_periodo: r.tipo_periodo ?? null,
      creado_en: r.creado_en,
      creado_por: r.creado_por_nombre ? `${r.creado_por_nombre} ${r.creado_por_apellido}` : null,
      cerrada_en: r.cerrada_en ?? null,
      cerrado_por: r.cerrado_por_nombre ? `${r.cerrado_por_nombre} ${r.cerrado_por_apellido}` : null,
      monto_total_pagado: r.monto_total_pagado !== null ? Number(r.monto_total_pagado) : null,
      cantidad_colaboradores_pagados: r.cantidad_colaboradores_pagados ?? null,
    })));
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  }

  const { fechaInicio, fechaFin, tipoPeriodo } = parsed.data;
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
      `INSERT INTO semanas_laborales (id, fecha_inicio, fecha_fin, estado, tipo_periodo, creado_por, creado_en)
       VALUES (gen_random_uuid(), $1, $2, 'ABIERTA', $3, $4, now())
       RETURNING id, fecha_inicio, fecha_fin, estado, tipo_periodo, creado_en`,
      [fechaInicio, fechaFin, tipoPeriodo ?? null, userId],
    );
    const semana = res.rows[0];

    try {
      await generarBorradoresSemana(client, semana.id as string, fechaInicio, fechaFin, tipoPeriodo ?? null);
    } catch { /* non-critical */ }

    return NextResponse.json({
      id: semana.id,
      fecha_inicio: semana.fecha_inicio,
      fecha_fin: semana.fecha_fin,
      estado: semana.estado,
      tipo_periodo: semana.tipo_periodo ?? null,
      creado_en: semana.creado_en,
      creado_por: null,
    }, { status: 201 });
  } finally {
    client.release();
  }
}
