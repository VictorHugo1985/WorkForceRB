'use client';

import { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { WizardFormValues } from '../RegistroWizard';

interface Dispositivo { id: string; nombre: string; numero_serie: string; }

export default function Step5CodigoBiometrico() {
  const { control, watch, setValue } = useFormContext<WizardFormValues>();
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [loading, setLoading] = useState(true);

  const codigoBiometrico = watch('codigo_biometrico');

  useEffect(() => {
    fetch('/api/dispositivos')
      .then((r) => r.json())
      .then((d) => setDispositivos(d.dispositivos ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && dispositivos.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6" gutterBottom>Código biométrico</Typography>
        <Alert severity="warning">
          No hay dispositivos biométricos registrados. El colaborador quedará sin código biométrico
          y no podrá resolver marcajes hasta que se registre un dispositivo y se le asigne un código.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" gutterBottom>Código biométrico</Typography>
      <Alert severity="info">
        Paso opcional. Si no se asigna ahora, puede configurarse desde el perfil del colaborador.
      </Alert>

      <Controller
        name="codigo_biometrico"
        control={control}
        render={({ field }) => (
          <FormControl fullWidth>
            <InputLabel>Dispositivo</InputLabel>
            <Select
              value={field.value?.dispositivo_id ?? ''}
              label="Dispositivo"
              onChange={(e) => {
                const val = e.target.value;
                field.onChange(val ? { dispositivo_id: val, workno: field.value?.workno ?? '' } : null);
              }}
            >
              <MenuItem value=""><em>Sin dispositivo</em></MenuItem>
              {dispositivos.map((d) => (
                <MenuItem key={d.id} value={d.id}>{d.nombre} — S/N: {d.numero_serie}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />

      {codigoBiometrico?.dispositivo_id && (
        <Controller
          name="codigo_biometrico"
          control={control}
          render={({ field }) => (
            <TextField
              label="Workno (código del empleado en el dispositivo)"
              value={field.value?.workno ?? ''}
              onChange={(e) =>
                field.onChange({ ...field.value, workno: e.target.value })
              }
              fullWidth
              required
            />
          )}
        />
      )}
    </Box>
  );
}
