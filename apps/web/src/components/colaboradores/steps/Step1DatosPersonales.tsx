'use client';

import { useFormContext, Controller } from 'react-hook-form';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { WizardFormValues } from '../RegistroWizard';

export default function Step1DatosPersonales() {
  const { register, control, formState: { errors } } = useFormContext<WizardFormValues>();

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
      <TextField
        label="Teléfono"
        {...register('telefono')}
        error={!!errors.telefono}
        helperText={errors.telefono?.message}
        fullWidth
      />
      <TextField
        label="Fecha de nacimiento"
        type="date"
        slotProps={{ inputLabel: { shrink: true } }}
        {...register('fecha_nacimiento')}
        error={!!errors.fecha_nacimiento}
        helperText={errors.fecha_nacimiento?.message}
        fullWidth
      />
      <Box>
        <Controller
          name="fijo"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={
                <Switch
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
              label="Colaborador fijo (salario fijo)"
            />
          )}
        />
        <FormHelperText>
          Los colaboradores fijos no participan en el cálculo de liquidaciones por horas.
        </FormHelperText>
      </Box>
    </Box>
  );
}
