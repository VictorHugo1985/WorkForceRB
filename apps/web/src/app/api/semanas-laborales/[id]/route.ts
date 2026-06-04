import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, verifyToken, isBlacklisted, COOKIE_NAME } from '@/lib/auth-server';
import { checkLiquidacionRole } from '@/lib/liquidacion-db';

const TIPO_PERIODO = ['SEMANAL', 'QUINCENAL', 'MENSUAL'] as const;

const PatchSchema = z.object({
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  tipoPeriodo: z.enum(TIPO_PERIODO).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkLiquidacionRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });
  }

  const { fechaInicio, fechaFin, tipoPeriodo } = parsed.data;
  if (fechaFin < fechaInicio) {
    return NextResponse.json({ message: 'La fecha fin debe ser posterior al inicio' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, estado FROM liquidacion_periodo WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ message: 'Período no encontrado' }, { status: 404 });
    }

    const dup = await client.query(
      `SELECT id FROM liquidacion_periodo WHERE fecha_inicio = $1 AND id != $2 LIMIT 1`,
      [fechaInicio, id],
    );
    if (dup.rows.length > 0) {
      return NextResponse.json({ message: 'Ya existe un período con esa fecha de inicio' }, { status: 409 });
    }

    const res = await client.query(
      `UPDATE liquidacion_periodo
       SET fecha_inicio = $1, fecha_fin = $2, tipo_periodo = $3
       WHERE id = $4
       RETURNING id, fecha_inicio, fecha_fin, estado, tipo_periodo, creado_en`,
      [fechaInicio, fechaFin, tipoPeriodo ?? null, id],
    );

    return NextResponse.json(res.rows[0]);
  } finally {
    client.release();
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT sl.id, sl.fecha_inicio, sl.fecha_fin, sl.estado, sl.tipo_periodo, sl.creado_en,
              sl.cerrada_en,
              uc.nombre AS creado_por_nombre, uc.apellido AS creado_por_apellido,
              ux.nombre AS cerrado_por_nombre, ux.apellido AS cerrado_por_apellido
       FROM liquidacion_periodo sl
       LEFT JOIN usuarios uc ON uc.id = sl.creado_por
       LEFT JOIN usuarios ux ON ux.id = sl.cerrada_por
       WHERE sl.id = $1`,
      [id],
    );
    if (res.rows.length === 0) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const r = res.rows[0];
    return NextResponse.json({
      id: r.id,
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      estado: r.estado,
      tipo_periodo: r.tipo_periodo ?? null,
      creado_en: r.creado_en,
      creado_por: r.creado_por_nombre ? `${r.creado_por_nombre} ${r.creado_por_apellido}` : null,
      cerrada_en: r.cerrada_en ?? null,
      cerrado_por: r.cerrado_por_nombre ? `${r.cerrado_por_nombre} ${r.cerrado_por_apellido}` : null,
      monto_total_pagado: null,
      cantidad_colaboradores_pagados: null,
    });
  } finally {
    client.release();
  }
}
