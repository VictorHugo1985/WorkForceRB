'use client';

import { useFormContext } from 'react-hook-form';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { WizardFormValues } from '../RegistroWizard';

export default function Step1DatosPersonales() {
  const { register, formState: { errors } } = useFormContext<WizardFormValues>();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" gutterBottom>Datos personales</Typography>
      <TextField
        label="Nombre(s)"
        {...register('nombre')}
        error={!!errors.nombre}
        helperText={errors.nombre?.message}
        fullWidth
        required
      />
      <TextField
        label="Apellido(s)"
        {...register('apellido')}
        error={!!errors.apellido}
        helperText={errors.apellido?.message}
        fullWidth
        required
      />
      <TextField
        label="Número de cédula"
        {...register('cedula')}
        error={!!errors.cedula}
        helperText={errors.cedula?.message}
        fullWidth
        required
      />
    </Box>
  );
}
