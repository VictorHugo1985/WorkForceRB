'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Link from 'next/link';
import ColaboradorPerfil from '@/components/colaboradores/ColaboradorPerfil';

export default function ColaboradorPage() {
  const { id } = useParams<{ id: string }>();
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/colaboradores/${id}`)
      .then((r) => {
        if (r.status === 404) throw new Error('Colaborador no encontrado');
        if (!r.ok) throw new Error('Error cargando perfil');
        return r.json();
      })
      .then(setPerfil)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Perfil del colaborador</Typography>
        <Button component={Link} href="/colaboradores/nuevo" variant="outlined" size="small">
          Registrar otro
        </Button>
      </Box>
      {perfil && <ColaboradorPerfil perfil={perfil} />}
    </Box>
  );
}
