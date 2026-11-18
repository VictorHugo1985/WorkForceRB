import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';
import { auditar, formatCentesimas, pesoSchema, sumaPesos, SUMA_OBJETIVO } from '@/lib/evaluaciones';

const CreateSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(100, 'Máximo 100 caracteres.'),
  descripcion: z
    .string()
    .trim()
    .max(500, 'Máximo 500 caracteres.')
    .nullish()
    .transform((s) => (s ? s : null)),
  peso: pesoSchema,
});

const SELECT_CRITERIOS = `
  SELECT c.id, c.nombre, c.descripcion, c.peso::text AS peso, c.activo,
         EXISTS (SELECT 1 FROM evaluacion_detalles d WHERE d.criterio_id = c.id) AS en_uso
    FROM criterios_evaluacion c`;

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const res = await client.query(`${SELECT_CRITERIOS} ORDER BY c.activo DESC, c.nombre`);
    const suma = sumaPesos(res.rows.filter((r) => r.activo).map((r) => r.peso));
    return NextResponse.json({
      criterios: res.rows,
      suma_activos: formatCentesimas(suma),
      configuracion_valida: suma === SUMA_OBJETIVO,
    });
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
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }
  const { nombre, descripcion, peso } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dup = await client.query(
      `SELECT 1 FROM criterios_evaluacion WHERE activo AND LOWER(nombre) = LOWER($1) LIMIT 1`,
      [nombre],
    );
    if (dup.rows.length > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Ya existe un criterio activo con ese nombre.' }, { status: 409 });
    }
    const ins = await client.query(
      `INSERT INTO criterios_evaluacion (nombre, descripcion, peso)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, descripcion, peso::text AS peso, activo, false AS en_uso`,
      [nombre, descripcion, peso],
    );
    const criterio = ins.rows[0];
    await auditar(client, {
      accion: 'CRITERIO_EVALUACION_CREADO',
      entidadTipo: 'CriterioEvaluacion',
      entidadId: criterio.id,
      usuarioId: auth.userId,
      descripcion: `Criterio de evaluación creado: ${nombre} (${criterio.peso}%)`,
      ip: req.headers.get('x-forwarded-for'),
      nuevos: criterio,
    });
    await client.query('COMMIT');
    return NextResponse.json({ criterio }, { status: 201 });
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
