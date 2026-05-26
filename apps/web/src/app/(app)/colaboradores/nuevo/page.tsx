import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import RegistroWizard from '@/components/colaboradores/RegistroWizard';

export const metadata = { title: 'Registrar colaborador' };

export default function NuevoColaboradorPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        Registrar nuevo colaborador
      </Typography>
      <RegistroWizard />
    </Box>
  );
}
