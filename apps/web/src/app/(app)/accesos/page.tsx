import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { AccesosListClient } from '@/components/accesos/AccesosListClient';
import type { AccesoRow } from '@/components/accesos/AccesosListClient';

const LIMIT = 50;

export default async function AccesosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token!);
  } catch {
    redirect('/login?reason=expired');
  }

  if (isBlacklisted(payload!.jti)) redirect('/login?reason=expired');
  if (!payload!.roles.includes('ADMINISTRADOR')) redirect('/dashboard');

  let accesos: AccesoRow[] = [];
  let total = 0;

  const client = await pool.connect();
  try {
    const [dataRes, countRes] = await Promise.all([
      client.query(
        `SELECT
           ra.id,
           ra.creado_en,
           CASE ra.accion WHEN 'LOGIN_EXITOSO' THEN 'exitoso' ELSE 'fallido' END AS resultado,
           ra.ip_origen,
           ra.descripcion,
           ra.usuario_id,
           u.nombre   AS usuario_nombre,
           u.apellido AS usuario_apellido,
           u.email    AS usuario_email
         FROM registros_auditoria ra
         LEFT JOIN usuarios u ON u.id = ra.usuario_id
         WHERE ra.accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')
         ORDER BY ra.creado_en DESC
         LIMIT $1`,
        [LIMIT],
      ),
      client.query(
        `SELECT COUNT(*) AS total
         FROM registros_auditoria
         WHERE accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')`,
      ),
    ]);

    accesos = dataRes.rows.map((r) => ({
      id: r.id,
      creado_en: r.creado_en,
      resultado: r.resultado,
      ip_origen: r.ip_origen ?? null,
      descripcion: r.descripcion ?? null,
      usuario_id: r.usuario_id ?? null,
      usuario_nombre: r.usuario_nombre
        ? `${r.usuario_nombre} ${r.usuario_apellido}`
        : null,
      usuario_email: r.usuario_email ?? null,
    }));
    total = parseInt(countRes.rows[0].total, 10);
  } finally {
    client.release();
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200 }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }} gutterBottom>
        Accesos
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Historial de intentos de inicio de sesión en el sistema.
      </Typography>
      <AccesosListClient initialAccesos={accesos} initialTotal={total} rowsPerPage={LIMIT} />
    </Box>
  );
}
