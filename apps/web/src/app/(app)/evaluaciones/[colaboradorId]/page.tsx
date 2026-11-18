import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import { pool, requirePageRoles } from '@/lib/auth-server';
import { obtenerHistorial, ROLES_EVALUACION } from '@/lib/evaluaciones';
import { HistorialClient } from '@/components/evaluaciones/HistorialClient';

export default async function HistorialEvaluacionesPage({
  params,
}: {
  params: Promise<{ colaboradorId: string }>;
}) {
  const payload = await requirePageRoles(ROLES_EVALUACION);
  const { colaboradorId } = await params;

  const client = await pool.connect();
  let historial;
  try {
    historial = await obtenerHistorial(client, colaboradorId);
  } finally {
    client.release();
  }
  if (!historial) notFound();

  // Normaliza fechas a string ISO (mismo formato que la API).
  const initial = {
    ...historial,
    evaluaciones: historial.evaluaciones.map((e) => ({
      ...e,
      creado_en: new Date(e.creado_en).toISOString(),
    })),
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200 }}>
      <HistorialClient initial={initial} isAdmin={payload.roles.includes('ADMINISTRADOR')} />
    </Box>
  );
}
