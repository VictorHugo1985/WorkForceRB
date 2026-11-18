import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const CreateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  alias: z.string().max(30).nullable().optional(),
  numero_serie: z.string().optional(),
  tipo: z.enum(['WEBHOOK', 'CSV']),
  webhook_secreto: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, nombre, alias, numero_serie, tipo, activo,
              (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto,
              creado_en, actualizado_en
       FROM dispositivos_biometricos ORDER BY nombre`,
    );
    return NextResponse.json({ dispositivos: result.rows });
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
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });

  const { nombre, alias, numero_serie, tipo, webhook_secreto } = parsed.data;

  if (tipo === 'WEBHOOK' && !webhook_secreto?.trim()) {
    return NextResponse.json(
      { message: 'El secreto webhook es requerido para dispositivos de tipo WEBHOOK.' },
      { status: 400 },
    );
  }

  const client = await pool.connect();
  try {
    if (numero_serie) {
      const dup = await client.query(
        `SELECT id FROM dispositivos_biometricos WHERE numero_serie = $1 LIMIT 1`,
        [numero_serie],
      );
      if (dup.rows.length > 0) {
        return NextResponse.json({ message: 'Ya existe un dispositivo con ese número de serie.' }, { status: 409 });
      }
    }

    const res = await client.query(
      `INSERT INTO dispositivos_biometricos (nombre, alias, numero_serie, tipo, webhook_secreto, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, nombre, alias, numero_serie, tipo, activo,
                 (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto,
                 creado_en, actualizado_en`,
      [nombre, alias ?? null, numero_serie ?? null, tipo, tipo === 'WEBHOOK' ? (webhook_secreto ?? null) : null],
    );
    const row = res.rows[0];

    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, datos_nuevos)
         VALUES ('RELOJ_REGISTRADO', 'DispositivoBiometrico', $1, $2, $3, $4)`,
        [row.id, auth.userId, `Registro de reloj biométrico: ${nombre}`,
         JSON.stringify({ nombre, numero_serie: numero_serie ?? null, tipo })],
      );
    } catch { /* audit non-blocking */ }

    return NextResponse.json(row, { status: 201 });
  } finally {
    client.release();
  }
}
