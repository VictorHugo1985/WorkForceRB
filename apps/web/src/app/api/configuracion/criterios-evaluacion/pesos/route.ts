import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';
import { auditar, formatCentesimas, pesoSchema, sumaPesos, SUMA_OBJETIVO } from '@/lib/evaluaciones';

const PutSchema = z.object({
  pesos: z
    .array(z.object({ id: z.string().uuid('Identificador de criterio inválido.'), peso: pesoSchema }))
    .min(1, 'Debe incluir todos los criterios activos.'),
});

export async function PUT(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }
  const { pesos } = parsed.data;

  if (sumaPesos(pesos.map((p) => p.peso)) !== SUMA_OBJETIVO) {
    return NextResponse.json({ error: 'Los pesos deben sumar 100%.' }, { status: 422 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const activos = await client.query(
      `SELECT id, peso::text AS peso FROM criterios_evaluacion WHERE activo ORDER BY id FOR UPDATE`,
    );
    const idsActivos = new Set<string>(activos.rows.map((r) => r.id));
    const idsBody = new Set(pesos.map((p) => p.id));
    const coinciden =
      idsBody.size === pesos.length &&
      idsBody.size === idsActivos.size &&
      [...idsBody].every((id) => idsActivos.has(id));
    if (!coinciden) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Debe incluir todos los criterios activos.' }, { status: 422 });
    }

    for (const p of pesos) {
      await client.query(
        `UPDATE criterios_evaluacion SET peso = $1, actualizado_en = now() WHERE id = $2`,
        [p.peso, p.id],
      );
    }

    await auditar(client, {
      accion: 'CRITERIO_EVALUACION_PESOS_ACTUALIZADOS',
      entidadTipo: 'CriterioEvaluacion',
      entidadId: null,
      usuarioId: auth.userId,
      descripcion: 'Pesos de criterios de evaluación redistribuidos',
      ip: req.headers.get('x-forwarded-for'),
      anteriores: activos.rows,
      nuevos: pesos.map((p) => ({ id: p.id, peso: formatCentesimas(Math.round(p.peso * 100)) })),
    });

    const res = await client.query(
      `SELECT c.id, c.nombre, c.descripcion, c.peso::text AS peso, c.activo,
              EXISTS (SELECT 1 FROM evaluacion_detalles d WHERE d.criterio_id = c.id) AS en_uso
         FROM criterios_evaluacion c
        ORDER BY c.activo DESC, c.nombre`,
    );
    await client.query('COMMIT');

    const suma = sumaPesos(res.rows.filter((r) => r.activo).map((r) => r.peso));
    return NextResponse.json({
      criterios: res.rows,
      suma_activos: formatCentesimas(suma),
      configuracion_valida: suma === SUMA_OBJETIVO,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
