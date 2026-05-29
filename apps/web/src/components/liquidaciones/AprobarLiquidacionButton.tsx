'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useLiquidacionStore } from '@/stores/liquidacion.store';
import { useSnackbar } from '@/lib/SnackbarContext';

interface Props {
  semanaLabel: string;
}

export function AprobarLiquidacionButton({ semanaLabel }: Props) {
  const { liquidacion, setAprobado } = useLiquidacionStore();
  const { showSuccess, showError } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!liquidacion) return null;
  const isAprobado = liquidacion.estado === 'APROBADO';

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/liquidaciones/${liquidacion.id}/aprobar`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.message ?? `Error ${res.status}`;
        setError(msg);
        showError(`No se pudo aprobar: ${msg}`);
        return;
      }
      setAprobado(json.aprobadoPor, json.aprobadaEn);
      setOpen(false);
      showSuccess('Liquidación aprobada correctamente.');
    } catch {
      const msg = 'Error de red. Intente de nuevo.';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      <Button
        variant="contained"
        color="success"
        fullWidth
        disabled={isAprobado}
        onClick={() => setOpen(true)}
      >
        {isAprobado ? 'Liquidación aprobada' : 'Aprobar liquidación'}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar aprobación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Desea aprobar la liquidación para la semana <strong>{semanaLabel}</strong>?
            Esta acción es irreversible y bloqueará futuras modificaciones.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirm}
            disabled={loading}
            autoFocus
          >
            Aprobar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
