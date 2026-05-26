'use client';

import { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormHelperText from '@mui/material/FormHelperText';
import Typography from '@mui/material/Typography';
import type { WizardFormValues } from '../RegistroWizard';

interface Area { id: string; nombre: string; }
interface Supervisor { id: string; nombre: string; apellido: string; }

export default function Step2AreaSupervisor() {
  const { control, formState: { errors } } = useFormContext<WizardFormValues>();
  const [areas, setAreas] = useState<Area[]>([]);
  const [supervisores, setSupervisores] = useState<Supervisor[]>([]);

  useEffect(() => {
    fetch('/api/areas').then((r) => r.json()).then((d) => setAreas(d.areas ?? []));
    fetch('/api/usuarios/supervisores').then((r) => r.json()).then((d) => setSupervisores(d.supervisores ?? []));
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" gutterBottom>Área y supervisor</Typography>

      <Controller
        name="area_id"
        control={control}
        render={({ field }) => (
          <FormControl fullWidth required error={!!errors.area_id}>
            <InputLabel>Área de trabajo</InputLabel>
            <Select {...field} label="Área de trabajo">
              {areas.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
              ))}
            </Select>
            {errors.area_id && <FormHelperText>{errors.area_id.message}</FormHelperText>}
          </FormControl>
        )}
      />

      <Controller
        name="supervisor_id"
        control={control}
        render={({ field }) => (
          <FormControl fullWidth>
            <InputLabel>Supervisor (opcional)</InputLabel>
            <Select {...field} value={field.value ?? ''} label="Supervisor (opcional)">
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
