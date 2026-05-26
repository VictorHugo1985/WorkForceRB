'use client';

import { useFormContext, Controller } from 'react-hook-form';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { WizardFormValues } from '../RegistroWizard';

export default function Step4Horario() {
  const { control } = useFormContext<WizardFormValues>();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" gutterBottom>Horario laboral</Typography>
      <Alert severity="info">
        Campo opcional. Si no se configura, se hereda la configuración global del sistema.
      </Alert>
      <Controller
        name="umbral_horas_extra"
        control={control}
        render={({ field }) => (
          <TextField
            label="Umbral de horas extra diarias (horas)"
            type="number"
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
            fullWidth
            helperText="Horas trabajadas por encima de este umbral cuentan como horas extra"
          />
        )}
      />
    </Box>
  );
}
