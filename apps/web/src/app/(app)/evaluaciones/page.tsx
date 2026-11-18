import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { pool, requirePageRoles } from '@/lib/auth-server';
import { listarColaboradoresEvaluacion, ROLES_EVALUACION } from '@/lib/evaluaciones';
import { EvaluacionesListClient } from '@/components/evaluaciones/EvaluacionesListClient';

const LIMIT = 50;

export default async function EvaluacionesPage() {
  await requirePageRoles(ROLES_EVALUACION);

  const client = await pool.connect();
  let data;
  try {
    data = await listarColaboradoresEvaluacion(client, { page: 1, limit: LIMIT });
  } finally {
    client.release();
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200 }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }} gutterBottom>
        Evaluaciones
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Evaluaciones de desempeño del personal.
      </Typography>
      <EvaluacionesListClient initialData={data} rowsPerPage={LIMIT} />
    </Box>
  );
}
