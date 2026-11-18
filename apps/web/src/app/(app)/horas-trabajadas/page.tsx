import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { pool, requirePageRoles } from '@/lib/auth-server';
import { generarReporte, ROLES_HORAS } from '@/lib/horas-trabajadas';
import { HorasTrabajadasClient } from '@/components/horas-trabajadas/HorasTrabajadasClient';

export default async function HorasTrabajadasPage() {
  await requirePageRoles(ROLES_HORAS);

  const client = await pool.connect();
  let reporte;
  try {
    reporte = await generarReporte(client, 'trimestre', 'mes');
  } finally {
    client.release();
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '100%' }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }} gutterBottom>
        Horas trabajadas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Horas trabajadas según las marcaciones del reloj biométrico.
      </Typography>
      <HorasTrabajadasClient initial={reporte} />
    </Box>
  );
}
