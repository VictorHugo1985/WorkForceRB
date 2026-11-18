'use client';

import { useEffect, useState } from 'react';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  formatFecha,
  formatHoras,
  type DetalleHorasResponse,
  type Tramo,
} from '@/lib/horas-trabajadas-types';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function diaSemana(iso: string): string {
  return DIAS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

export interface DetalleHorasDialogProps {
  open: boolean;
  onClose: () => void;
  colaborador: { id: string; nombre: string; apellido: string } | null;
  tramo: Tramo | null;
}

export function DetalleHorasDialog({ open, onClose, colaborador, tramo }: DetalleHorasDialogProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [data, setData] = useState<DetalleHorasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !colaborador || !tramo) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({ colaborador_id: colaborador.id, desde: tramo.desde, hasta: tramo.hasta });
    fetch(`/api/horas-trabajadas/detalle?${params}`)
      .then(async (res) => {
        if (res.status === 401) {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          router.push('/login?reason=expired');
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(body.error ?? 'No se pudo cargar el detalle.'); return; }
        setData(body);
      })
      .catch(() => { if (!cancelled) setError('Error de conexión.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, colaborador, tramo, router]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle>
        {colaborador ? `${colaborador.apellido}, ${colaborador.nombre}` : 'Detalle'}
        {tramo && (
          <Typography variant="body2" color="text.secondary">
            Del {formatFecha(tramo.desde)} al {formatFecha(tramo.hasta)}
            {tramo.parcial ? ' (parcial)' : ''}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {data && data.dias.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            Sin marcaciones en este período.
          </Typography>
        )}
        {data && data.dias.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>Entrada</TableCell>
                <TableCell>Salida</TableCell>
                <TableCell align="right">Horas</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.dias.map((d) => (
                <TableRow key={d.fecha} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {diaSemana(d.fecha)} {formatFecha(d.fecha)}
                    {d.pares.length > 1 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {d.pares.map((p) => `${p.entrada}–${p.salida}`).join(' · ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{d.primera_entrada ?? '—'}</TableCell>
                  <TableCell>{d.ultima_salida ?? '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatHoras(d.horas)}
                  </TableCell>
                  <TableCell>
                    {d.incompleta ? (
                      <Tooltip title={`Marcación sin pareja: ${d.marcacion_suelta ?? '—'} (no suma horas)`}>
                        <Chip label="Incompleto" color="warning" size="small" />
                      </Tooltip>
                    ) : (
                      <Chip label="OK" size="small" variant="outlined" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} sx={{ fontWeight: 600 }}>
                  Total
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatHoras(data.total_horas)} h
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
