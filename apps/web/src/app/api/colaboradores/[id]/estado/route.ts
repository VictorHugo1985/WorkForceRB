import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const EstadoSchema = z.object({
  activo: z.boolean(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = EstadoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });
  }

  const { activo } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, activo FROM colaboradores WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const prevActivo = existing.rows[0].activo as boolean;

    await client.query(
      `UPDATE colaboradores SET activo = $1, actualizado_en = now() WHERE id = $2`,
      [activo, id],
    );

    try {
      const accion = activo ? 'COLABORADOR_REACTIVADO' : 'COLABORADOR_BAJA';
      const ip = req.headers.get('x-forwarded-for') ?? null;
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_anteriores, datos_nuevos)
         VALUES ($1, 'Colaborador', $2, $3, $4, $5, $6, $7)`,
        [
          accion,
          id,
          userId,
          activo ? 'Colaborador reactivado' : 'Colaborador dado de baja',
          ip,
          JSON.stringify({ activo: prevActivo }),
          JSON.stringify({ activo }),
        ],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({ colaborador: { id, activo } });
  } finally {
    client.release();
  }
}
