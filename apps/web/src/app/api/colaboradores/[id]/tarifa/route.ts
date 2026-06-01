import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const TarifaSchema = z.object({
  valor: z.number().positive('La tarifa debe ser mayor a 0'),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const { id: colaboradorId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  const parsed = TarifaSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.')] = issue.message;
    }
    return NextResponse.json({ error: 'VALIDATION_ERROR', fields }, { status: 400 });
  }

  const { valor } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, tarifa_hora FROM colaboradores WHERE id = $1`,
      [colaboradorId],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const valorAnterior = existing.rows[0].tarifa_hora !== null ? Number(existing.rows[0].tarifa_hora) : null;

    await client.query(
      `UPDATE colaboradores SET tarifa_hora = $1, actualizado_en = now() WHERE id = $2`,
      [valor, colaboradorId],
    );

    try {
      const ip = req.headers.get('x-forwarded-for') ?? null;
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_anteriores, datos_nuevos)
         VALUES ('TARIFA_HORA_ACTUALIZADA', 'Colaborador', $1, $2, $3, $4, $5, $6)`,
        [
          colaboradorId,
          userId,
          `Actualización tarifa: ${valorAnterior ?? 'N/A'} → ${valor} Bs./h`,
          ip,
          JSON.stringify({ tarifa_hora: valorAnterior }),
          JSON.stringify({ tarifa_hora: valor }),
        ],
      );
    } catch { /* audit failure does not block response */ }

    return NextResponse.json({ tarifa_hora: valor });
  } finally {
    client.release();
  }
}
