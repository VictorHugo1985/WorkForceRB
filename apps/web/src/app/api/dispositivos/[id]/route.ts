import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const PatchSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  alias: z.string().max(30).nullable().optional(),
  numero_serie: z.string().nullable().optional(),
  tipo: z.enum(['WEBHOOK', 'CSV']).optional(),
  webhook_secreto: z.string().optional(),
  activo: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });

  const { nombre, alias, numero_serie, tipo, webhook_secreto, activo } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, nombre, alias, numero_serie, tipo, activo, webhook_secreto
       FROM dispositivos_biometricos WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ message: 'Dispositivo no encontrado' }, { status: 404 });
    }
    const prev = existing.rows[0];

    const newSerial = numero_serie !== undefined ? numero_serie : prev.numero_serie;
    if (newSerial && newSerial !== prev.numero_serie) {
      const dup = await client.query(
        `SELECT id FROM dispositivos_biometricos WHERE numero_serie = $1 AND id != $2 LIMIT 1`,
        [newSerial, id],
      );
      if (dup.rows.length > 0) {
        return NextResponse.json({ message: 'Ya existe un dispositivo con ese número de serie.' }, { status: 409 });
      }
    }

    const newTipo = tipo ?? prev.tipo;
    let newSecret = prev.webhook_secreto;
    if (newTipo === 'CSV') {
      newSecret = null;
    } else if (webhook_secreto && webhook_secreto.trim() !== '') {
      newSecret = webhook_secreto;
    }

    const newAlias = alias !== undefined ? (alias ?? null) : prev.alias;

    const res = await client.query(
      `UPDATE dispositivos_biometricos
       SET nombre = $1, alias = $2, numero_serie = $3, tipo = $4, webhook_secreto = $5, activo = $6, actualizado_en = NOW()
       WHERE id = $7
       RETURNING id, nombre, alias, numero_serie, tipo, activo,
                 (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto,
                 actualizado_en`,
      [nombre ?? prev.nombre, newAlias, newSerial, newTipo, newSecret, activo ?? prev.activo, id],
    );
    const row = res.rows[0];

    let accion = 'RELOJ_MODIFICADO';
    if (activo !== undefined && activo !== prev.activo) {
      accion = activo ? 'RELOJ_ACTIVADO' : 'RELOJ_INACTIVADO';
    }

    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, datos_anteriores, datos_nuevos)
         VALUES ($1, 'DispositivoBiometrico', $2, $3, $4, $5)`,
        [accion, id, auth.userId,
         JSON.stringify({ nombre: prev.nombre, numero_serie: prev.numero_serie, tipo: prev.tipo, activo: prev.activo }),
         JSON.stringify({ nombre: row.nombre, numero_serie: row.numero_serie, tipo: row.tipo, activo: row.activo })],
      );
    } catch { /* audit non-blocking */ }

    return NextResponse.json(row);
  } finally {
    client.release();
  }
}
