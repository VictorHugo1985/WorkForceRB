import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkRoles } from '@/lib/auth-server';
import {
  auditar,
  calcularPuntajeFinal,
  criteriosActivos,
  fetchEvaluacionDetalle,
  PUNTAJE_MAX,
  PUNTAJE_MIN,
  ROLES_EVALUACION,
  todayGMTMinus4,
} from '@/lib/evaluaciones';

const PostSchema = z.object({
  colaborador_id: z.string().uuid('Colaborador inválido.'),
  fecha_evaluacion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de evaluación inválida.')
    .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Fecha de evaluación inválida.'),
  comentario: z
    .string()
    .trim()
    .max(1000, 'El comentario admite como máximo 1000 caracteres.')
    .nullish()
    .transform((s) => (s ? s : null)),
  config_version: z.string().min(1, 'Falta la versión de criterios.'),
  puntajes: z
    .array(
      z.object({
        criterio_id: z.string().uuid('Criterio inválido.'),
        puntaje: z
          .number()
          .int('El puntaje debe ser un número entero.')
          .min(PUNTAJE_MIN, `El puntaje debe estar entre ${PUNTAJE_MIN} y ${PUNTAJE_MAX}.`)
          .max(PUNTAJE_MAX, `El puntaje debe estar entre ${PUNTAJE_MIN} y ${PUNTAJE_MAX}.`),
      }),
    )
    .min(1, 'Debe calificar todos los criterios.'),
});

export async function POST(req: NextRequest) {
  const auth = await checkRoles(req, ROLES_EVALUACION);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }
  const { colaborador_id, fecha_evaluacion, comentario, config_version, puntajes } = parsed.data;

  if (fecha_evaluacion > todayGMTMinus4()) {
    return NextResponse.json({ error: 'La fecha de evaluación no puede ser futura.' }, { status: 422 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const colRes = await client.query(
      `SELECT id, nombre, apellido, activo FROM colaboradores WHERE id = $1`,
      [colaborador_id],
    );
    if (colRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'COLABORADOR_NOT_FOUND' }, { status: 404 });
    }
    const colaborador = colRes.rows[0];
    if (!colaborador.activo) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'COLABORADOR_INACTIVO' }, { status: 409 });
    }

    const activos = await criteriosActivos(client, true);
    if (!activos.valida) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'CRITERIOS_NO_SUMAN_100' }, { status: 409 });
    }
    if (activos.version !== config_version) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'CRITERIOS_CAMBIARON' }, { status: 409 });
    }

    const porCriterio = new Map<string, number>();
    for (const p of puntajes) {
      if (porCriterio.has(p.criterio_id)) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Hay criterios calificados más de una vez.' }, { status: 422 });
      }
      porCriterio.set(p.criterio_id, p.puntaje);
    }
    const faltantes = activos.criterios.filter((c) => !porCriterio.has(c.id)).map((c) => c.nombre);
    if (faltantes.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: `Faltan puntajes para: ${faltantes.join(', ')}.` }, { status: 422 });
    }
    if (porCriterio.size !== activos.criterios.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Hay puntajes para criterios que no están activos.' }, { status: 422 });
    }

    const items = activos.criterios.map((c) => ({
      criterio_id: c.id,
      criterio_nombre: c.nombre,
      peso: c.peso,
      puntaje: porCriterio.get(c.id)!,
    }));
    const puntajeFinal = calcularPuntajeFinal(items);

    const ins = await client.query(
      `INSERT INTO evaluaciones (colaborador_id, evaluador_id, fecha_evaluacion, puntaje_final, comentario)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [colaborador_id, auth.userId, fecha_evaluacion, puntajeFinal, comentario],
    );
    const evaluacionId: string = ins.rows[0].id;

    for (const it of items) {
      await client.query(
        `INSERT INTO evaluacion_detalles (evaluacion_id, criterio_id, criterio_nombre, peso, puntaje)
         VALUES ($1, $2, $3, $4, $5)`,
        [evaluacionId, it.criterio_id, it.criterio_nombre, it.peso, it.puntaje],
      );
    }

    await auditar(client, {
      accion: 'EVALUACION_REGISTRADA',
      entidadTipo: 'Evaluacion',
      entidadId: evaluacionId,
      usuarioId: auth.userId,
      descripcion: `Evaluación registrada para ${colaborador.nombre} ${colaborador.apellido}: ${puntajeFinal}`,
      ip: req.headers.get('x-forwarded-for'),
      nuevos: { colaborador_id, fecha_evaluacion, puntaje_final: puntajeFinal, comentario, detalles: items },
    });

    const evaluacion = await fetchEvaluacionDetalle(client, evaluacionId);
    await client.query('COMMIT');
    return NextResponse.json({ evaluacion }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
