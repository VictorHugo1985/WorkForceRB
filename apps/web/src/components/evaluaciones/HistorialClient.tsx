'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AddTaskIcon from '@mui/icons-material/AddTask';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSnackbar } from '@/lib/SnackbarContext';
import type { HistorialResponse } from '@/lib/evaluaciones-types';
import { NuevaEvaluacionDialog } from './NuevaEvaluacionDialog';
import { EvaluacionDetalleDialog, formatFecha } from './EvaluacionDetalleDialog';

export interface HistorialClientProps {
  initial: HistorialResponse;
  isAdmin: boolean;
}

export function HistorialClient({ initial, isAdmin }: HistorialClientProps) {
  const { showError } = useSnackbar();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [data, setData] = useState(initial);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { colaborador, resumen, evaluaciones } = data;

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/evaluaciones/colaboradores/${colaborador.id}`);
      if (res.status === 401) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        router.push('/login?reason=expired');
        return;
      }
      if (!res.ok) { showError('Error al actualizar el histórico.'); return; }
      setData(await res.json());
    } catch {
      showError('Error de conexión.');
    }
  }, [colaborador.id, router, showError]);

  return (
    <Box>
      <Button component={Link} href="/evaluaciones" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 2 }}>
        Volver a Evaluaciones
      </Button>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {colaborador.apellido}, {colaborador.nombre}
            {!colaborador.activo && <Chip label="Inactivo" size="small" sx={{ ml: 1, verticalAlign: 'middle' }} />}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cédula {colaborador.cedula} · Histórico de evaluaciones
          </Typography>
        </Box>
        {colaborador.activo && (
          <Button variant="contained" startIcon={<AddTaskIcon />} onClick={() => setNuevaOpen(true)}>
            Nueva evaluación
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <Resumen label="Puntaje promedio" value={resumen.puntaje_promedio ?? '—'} suffix={resumen.puntaje_promedio ? '/ 10' : ''} />
        <Resumen label="Evaluaciones vigentes" value={String(resumen.total_vigentes)} />
        <Resumen
          label="Última evaluación"
          value={resumen.ultima_evaluacion ? formatFecha(resumen.ultima_evaluacion) : '—'}
        />
      </Box>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                {!isMobile && <TableCell>Evaluador</TableCell>}
                <TableCell align="right">Puntaje</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {evaluaciones.map((e) => (
                <TableRow
                  key={e.id}
                  hover
                  onClick={() => setDetalleId(e.id)}
                  sx={{ cursor: 'pointer', opacity: e.estado === 'ANULADA' ? 0.55 : 1 }}
                >
                  <TableCell>{formatFecha(e.fecha_evaluacion)}</TableCell>
                  {!isMobile && <TableCell>{e.evaluador_nombre}</TableCell>}
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 600, textDecoration: e.estado === 'ANULADA' ? 'line-through' : 'none' }}
                  >
                    {e.puntaje_final}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={e.estado === 'VIGENTE' ? 'Vigente' : 'Anulada'}
                      color={e.estado === 'VIGENTE' ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {evaluaciones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Este colaborador aún no tiene evaluaciones.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <NuevaEvaluacionDialog
        open={nuevaOpen}
        colaborador={colaborador}
        onClose={() => setNuevaOpen(false)}
        onSaved={reload}
      />
      <EvaluacionDetalleDialog
        evaluacionId={detalleId}
        open={detalleId !== null}
        onClose={() => setDetalleId(null)}
        isAdmin={isAdmin}
        onChanged={reload}
      />
    </Box>
  );
}

function Resumen({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        {value}
        {suffix && (
          <Typography component="span" variant="body2" color="text.secondary">
            {' '}
            {suffix}
          </Typography>
        )}
      </Typography>
    </Paper>
  );
}
