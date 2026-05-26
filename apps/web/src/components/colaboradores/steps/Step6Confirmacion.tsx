'use client';

import { useFormContext } from 'react-hook-form';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import type { WizardFormValues } from '../RegistroWizard';

export default function Step6Confirmacion() {
  const { watch } = useFormContext<WizardFormValues>();
  const values = watch();

  const rows: { label: string; value: string }[] = [
    { label: 'Nombre', value: `${values.nombre} ${values.apellido}` },
    { label: 'Cédula', value: values.cedula },
    { label: 'Área', value: values.area_id ? '(seleccionada)' : '—' },
    { label: 'Supervisor', value: values.supervisor_id ? '(seleccionado)' : 'Sin supervisor' },
    { label: 'Tarifa por hora', value: values.tarifa_hora ? `${values.tarifa_hora.toLocaleString()} COP` : 'Hereda global' },
    { label: 'Umbral horas extra', value: values.umbral_horas_extra ? `${values.umbral_horas_extra} h/día` : 'Hereda global' },
    { label: 'Código biométrico', value: values.codigo_biometrico?.workno ? `Workno: ${values.codigo_biometrico.workno}` : 'Sin asignar' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="h6" gutterBottom>Confirmación</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Revisa los datos antes de confirmar. Pulsa &quot;Confirmar registro&quot; para crear el colaborador.
      </Typography>
      <Divider />
      {rows.map(({ label, value }) => (
        <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
        </Box>
      ))}
      <Divider />
    </Box>
  );
}
