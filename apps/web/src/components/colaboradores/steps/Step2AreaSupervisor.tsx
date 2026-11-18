'use client';

import { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import type { WizardFormValues } from '../RegistroWizard';

interface Supervisor { id: string; nombre: string; apellido: string; }

export default function Step2AreaSupervisor() {
  const { control } = useFormContext<WizardFormValues>();
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);

  useEffect(() => {
    fetch('/api/usuarios/supervisores').then((r) => r.json()).then((d) => setSupervisores(d.supervisores ?? []));
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" gutterBottom>Supervisor</Typography>

      <Controller
        name="supervisor_id"
        control={control}
        render={({ field }) => (
          <FormControl fullWidth>
            <InputLabel>Supervisor (opcional)</InputLabel>
            <Select
              {...field}
              value={field.value ?? ''}
              label="Supervisor (opcional)"
              onChange={(e) => field.onChange(e.target.value || null)}
            >
              <MenuItem value=""><em>Sin supervisor</em></MenuItem>
              {supervisores.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.nombre} {s.apellido}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />
    </Box>
  );
}
