import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';
import { auditar, pesoSchema, UUID_RE } from '@/lib/evaluaciones';

const PatchSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(100, 'Máximo 100 caracteres.').optional(),
    descripcion: z
      .string()
      .trim()
      .max(500, 'Máximo 500 caracteres.')
      .nullable()
      .optional()
      .transform((s) => (s === undefined ? undefined : s ? s : null)),
    peso: pesoSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine(
    (d) => d.nombre !== undefined || d.descripcion !== undefined || d.peso !== undefined || d.activo !== undefined,
    { message: 'Se requiere al menos un campo para actualizar.' },
  );

const RETURNING = `id, nombre, descripcion, peso::text AS peso, activo,
  EXISTS (SELECT 1 FROM evaluacion_detalles d WHERE d.criterio_id = criterios_evaluacion.id) AS en_uso`;

export async function PATCH(
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
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }
  const changes = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prevRes = await client.query(
      `SELECT ${RETURNING} FROM criterios_evaluacion WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (prevRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const prev = prevRes.rows[0];

    const nombreFinal = changes.nombre ?? prev.nombre;
    const activoFinal = changes.activo ?? prev.activo;
    if (activoFinal) {
      const dup = await client.query(
        `SELECT 1 FROM criterios_evaluacion
          WHERE activo AND id <> $1 AND LOWER(nombre) = LOWER($2) LIMIT 1`,
        [id, nombreFinal],
      );
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Ya existe un criterio activo con ese nombre.' }, { status: 409 });
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (col: string, v: unknown) => {
      values.push(v);
      sets.push(`${col} = $${values.length}`);
    };
    if (changes.nombre !== undefined) add('nombre', changes.nombre);
    if (changes.descripcion !== undefined) add('descripcion', changes.descripcion);
    if (changes.peso !== undefined) add('peso', changes.peso);
    if (changes.activo !== undefined) add('activo', changes.activo);
    values.push(id);

    const upd = await client.query(
      `UPDATE criterios_evaluacion
          SET ${sets.join(', ')}, actualizado_en = now()
        WHERE id = $${values.length}
        RETURNING ${RETURNING}`,
      values,
    );
    const criterio = upd.rows[0];

    let descripcion = `Criterio de evaluación actualizado: ${criterio.nombre}`;
    if (changes.activo !== undefined && changes.activo !== prev.activo) {
      descripcion = `Criterio de evaluación ${changes.activo ? 'activado' : 'desactivado'}: ${criterio.nombre}`;
    }
    await auditar(client, {
      accion: 'CRITERIO_EVALUACION_ACTUALIZADO',
      entidadTipo: 'CriterioEvaluacion',
      entidadId: id,
      usuarioId: auth.userId,
      descripcion,
      ip: req.headers.get('x-forwarded-for'),
      anteriores: prev,
      nuevos: criterio,
    });
    await client.query('COMMIT');
    return NextResponse.json({ criterio });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ya existe un criterio activo con ese nombre.' }, { status: 409 });
    }
    throw err;
  } finally {
    client.release();
  }
}
