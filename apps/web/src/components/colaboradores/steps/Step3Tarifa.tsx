'use client';

import { useFormContext, Controller } from 'react-hook-form';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { WizardFormValues } from '../RegistroWizard';

export default function Step3Tarifa() {
  const { control } = useFormContext<WizardFormValues>();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" gutterBottom>Tarifa salarial</Typography>
      <Alert severity="info">
        Campo opcional. Si no se configura, se usará la tarifa global vigente al momento de liquidar.
      </Alert>
      <Controller
        name="tarifa_hora"
        control={control}
        render={({ field }) => (
          <TextField
            label="Tarifa por hora (COP)"
            type="number"
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
            fullWidth
          />
        )}
      />
    </Box>
  );
}
