import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const PatchTipoAjusteSchema = z.object({
  nombre: z.string().min(1).max(100).transform((s) => s.trim()).optional(),
  activo: z.boolean().optional(),
}).refine((d) => d.nombre !== undefined || d.activo !== undefined, {
  message: 'Se requiere al menos un campo para actualizar.',
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = PatchTipoAjusteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const { nombre, activo } = parsed.data;
  const client = await pool.connect();
  try {
    const existing = await client.query(`SELECT id FROM tipos_ajuste WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Tipo de ajuste no encontrado.' }, { status: 404 });
    }

    if (activo === false) {
      const activeCount = await client.query(
        `SELECT COUNT(*) FROM tipos_ajuste WHERE activo = true AND id != $1`,
        [id],
      );
      if (Number(activeCount.rows[0].count) === 0) {
        return NextResponse.json(
          { error: 'Debe existir al menos un tipo de ajuste activo.' },
          { status: 422 },
        );
      }
    }

    if (nombre !== undefined) {
      const dup = await client.query(
        `SELECT id FROM tipos_ajuste WHERE nombre = $1 AND id != $2 LIMIT 1`,
        [nombre, id],
      );
      if (dup.rows.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe un tipo de ajuste con ese nombre.' },
          { status: 409 },
        );
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (nombre !== undefined) { sets.push(`nombre = $${i++}`); values.push(nombre); }
    if (activo !== undefined) { sets.push(`activo = $${i++}`); values.push(activo); }
    values.push(id);

    const res = await client.query(
      `UPDATE tipos_ajuste SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, nombre, activo, creado_en`,
      values,
    );
    return NextResponse.json({ tipoAjuste: res.rows[0] });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const existing = await client.query(`SELECT id FROM tipos_ajuste WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Tipo de ajuste no encontrado.' }, { status: 404 });
    }

    const inUse = await client.query(
      `SELECT COUNT(*) FROM liquidacion_jornada WHERE ajuste_tipo_id = $1`,
      [id],
    );
    if (Number(inUse.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar porque está siendo usado en registros de liquidación.' },
        { status: 422 },
      );
    }

    await client.query(`DELETE FROM tipos_ajuste WHERE id = $1`, [id]);
    return new NextResponse(null, { status: 204 });
  } finally {
    client.release();
  }
}
