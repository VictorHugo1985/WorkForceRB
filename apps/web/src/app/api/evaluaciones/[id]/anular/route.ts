import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';
import { auditar, fetchEvaluacionDetalle, UUID_RE } from '@/lib/evaluaciones';

const AnularSchema = z.object({
  motivo: z
    .string({ message: 'El motivo es obligatorio.' })
    .trim()
    .min(1, 'El motivo es obligatorio.')
    .max(500, 'El motivo admite como máximo 500 caracteres.'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = AnularSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }
  const { motivo } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(
      `SELECT e.estado, c.nombre, c.apellido
         FROM evaluaciones e JOIN colaboradores c ON c.id = e.colaborador_id
        WHERE e.id = $1
        FOR UPDATE OF e`,
      [id],
    );
    if (cur.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (cur.rows[0].estado === 'ANULADA') {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'YA_ANULADA' }, { status: 409 });
    }

    await client.query(
      `UPDATE evaluaciones
          SET estado = 'ANULADA', motivo_anulacion = $1, anulada_por = $2, anulada_en = now()
        WHERE id = $3`,
      [motivo, auth.userId, id],
    );
    await auditar(client, {
      accion: 'EVALUACION_ANULADA',
      entidadTipo: 'Evaluacion',
      entidadId: id,
      usuarioId: auth.userId,
      descripcion: `Evaluación anulada (${cur.rows[0].nombre} ${cur.rows[0].apellido}): ${motivo}`,
      ip: req.headers.get('x-forwarded-for'),
      anteriores: { estado: 'VIGENTE' },
      nuevos: { estado: 'ANULADA', motivo },
    });
    const evaluacion = await fetchEvaluacionDetalle(client, id);
    await client.query('COMMIT');
    return NextResponse.json({ evaluacion });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
