'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { EvaluacionDetalle } from '@/lib/evaluaciones-types';
import { AnularEvaluacionDialog } from './AnularEvaluacionDialog';

export function formatFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface EvaluacionDetalleDialogProps {
  evaluacionId: string | null;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onChanged: () => void;
}

export function EvaluacionDetalleDialog({ evaluacionId, open, onClose, isAdmin, onChanged }: EvaluacionDetalleDialogProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [evaluacion, setEvaluacion] = useState<EvaluacionDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anularOpen, setAnularOpen] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evaluaciones/${id}`);
      if (res.status === 401) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        router.push('/login?reason=expired');
        return;
      }
      if (!res.ok) { setError('No se pudo cargar la evaluación.'); return; }
      setEvaluacion((await res.json()).evaluacion);
    } catch {
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (open && evaluacionId) {
      setEvaluacion(null);
      load(evaluacionId);
    }
  }, [open, evaluacionId, load]);

  const ev = evaluacion;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        Detalle de evaluación
        {ev && (
          <Chip
            size="small"
            label={ev.estado === 'VIGENTE' ? 'Vigente' : 'Anulada'}
            color={ev.estado === 'VIGENTE' ? 'success' : 'default'}
          />
        )}
      </DialogTitle>
      <DialogContent dividers>
        {loading && !ev && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {ev && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ev.anulacion && (
              <Alert severity="warning">
                <strong>Evaluación anulada</strong> por {ev.anulacion.anulada_por_nombre} el{' '}
                {formatFechaHora(ev.anulacion.anulada_en)}.
                <br />
                Motivo: {ev.anulacion.motivo}
              </Alert>
            )}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <Dato label="Colaborador" value={`${ev.colaborador.apellido}, ${ev.colaborador.nombre}`} />
              <Dato label="Fecha de evaluación" value={formatFecha(ev.fecha_evaluacion)} />
              <Dato label="Evaluador" value={ev.evaluador_nombre} />
              <Dato label="Registrada el" value={formatFechaHora(ev.creado_en)} />
            </Box>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Criterio</TableCell>
                  <TableCell align="right">Peso</TableCell>
                  <TableCell align="right">Puntaje</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ev.detalles.map((d) => (
                  <TableRow key={d.criterio_nombre}>
                    <TableCell>{d.criterio_nombre}</TableCell>
                    <TableCell align="right">{d.peso}%</TableCell>
                    <TableCell align="right">{d.puntaje} / 10</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2} sx={{ fontWeight: 600 }}>
                    Puntaje final
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      textDecoration: ev.estado === 'ANULADA' ? 'line-through' : 'none',
                    }}
                  >
                    {ev.puntaje_final}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Comentario
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {ev.comentario ?? '—'}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {isAdmin && ev?.estado === 'VIGENTE' && (
          <Button color="error" onClick={() => setAnularOpen(true)} sx={{ mr: 'auto' }}>
            Anular evaluación
          </Button>
        )}
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>

      {isAdmin && ev && (
        <AnularEvaluacionDialog
          evaluacionId={ev.id}
          open={anularOpen}
          onClose={() => setAnularOpen(false)}
          onAnulada={(actualizada) => {
            setEvaluacion(actualizada);
            setAnularOpen(false);
            onChanged();
          }}
        />
      )}
    </Dialog>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}
