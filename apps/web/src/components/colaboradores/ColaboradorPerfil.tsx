'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';

interface ColaboradorPerfilProps {
  perfil: {
    id: string;
    nombre: string;
    apellido: string;
    cedula: string;
    activo: boolean;
    creado_en: string;
    area: { id: string; nombre: string } | null;
    supervisor: { id: string; nombre: string; apellido: string } | null;
    tarifa_vigente: { id: string; valor: number; unidad: string; vigente_desde: string } | null;
    horario_vigente: { id: string; umbral_horas_extra: number; vigente_desde: string } | null;
    codigos_biometricos: Array<{
      id: string;
      workno: string;
      activo: boolean;
      dispositivo: { id: string; nombre: string; numero_serie: string };
    }>;
  };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

export default function ColaboradorPerfil({ perfil }: ColaboradorPerfilProps) {
  return (
    <Box sx={{ maxWidth: 640 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {perfil.nombre} {perfil.apellido}
        </Typography>
        <Chip
          label={perfil.activo ? 'Activo' : 'Inactivo'}
          color={perfil.activo ? 'success' : 'default'}
          size="small"
        />
      </Box>

      <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 2, mb: 1 }}>Datos personales</Typography>
      <Divider sx={{ mb: 1 }} />
      <Row label="Cédula" value={perfil.cedula} />
      <Row label="Área de trabajo" value={perfil.area?.nombre ?? '—'} />
      <Row label="Supervisor" value={perfil.supervisor ? `${perfil.supervisor.nombre} ${perfil.supervisor.apellido}` : 'Sin supervisor'} />
      <Row label="Registrado el" value={new Date(perfil.creado_en).toLocaleDateString('es-VE')} />

      <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 3, mb: 1 }}>Tarifa salarial</Typography>
      <Divider sx={{ mb: 1 }} />
      {perfil.tarifa_vigente ? (
        <>
          <Row label="Tarifa por hora" value={`${Number(perfil.tarifa_vigente.valor).toLocaleString()} ${perfil.tarifa_vigente.unidad}`} />
          <Row label="Vigente desde" value={perfil.tarifa_vigente.vigente_desde} />
        </>
      ) : (
        <Alert severity="warning" sx={{ mt: 1 }}>Sin tarifa propia — se usará la tarifa global al liquidar.</Alert>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 3, mb: 1 }}>Horario laboral</Typography>
      <Divider sx={{ mb: 1 }} />
      {perfil.horario_vigente ? (
        <>
          <Row label="Umbral horas extra / día" value={`${perfil.horario_vigente.umbral_horas_extra} h`} />
          <Row label="Vigente desde" value={perfil.horario_vigente.vigente_desde} />
        </>
      ) : (
        <Alert severity="info" sx={{ mt: 1 }}>Sin horario propio — hereda la configuración global.</Alert>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 3, mb: 1 }}>Códigos biométricos</Typography>
      <Divider sx={{ mb: 1 }} />
      {perfil.codigos_biometricos.length === 0 ? (
        <Alert severity="warning">Sin código biométrico asignado. El colaborador no puede resolver marcajes.</Alert>
      ) : (
        perfil.codigos_biometricos.map((c) => (
          <Box key={c.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography variant="body2" color="text.secondary">{c.dispositivo.nombre} (S/N: {c.dispositivo.numero_serie})</Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>Workno: {c.workno}</Typography>
          </Box>
        ))
      )}
    </Box>
  );
}
