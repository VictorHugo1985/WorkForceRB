'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useSnackbar } from '@/lib/SnackbarContext';
import type { EvaluacionDetalle } from '@/lib/evaluaciones-types';

export interface AnularEvaluacionDialogProps {
  evaluacionId: string;
  open: boolean;
  onClose: () => void;
  onAnulada: (evaluacion: EvaluacionDetalle) => void;
}

export function AnularEvaluacionDialog({ evaluacionId, open, onClose, onAnulada }: AnularEvaluacionDialogProps) {
  const { showSuccess } = useSnackbar();
  const router = useRouter();
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setMotivo(''); setError(null); }
  }, [open]);

  const handleAnular = async () => {
    if (!motivo.trim()) { setError('El motivo es obligatorio.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/evaluaciones/${evaluacionId}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      if (res.status === 401) {
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        router.push('/login?reason=expired');
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const mensajes: Record<string, string> = {
          YA_ANULADA: 'La evaluación ya estaba anulada.',
          NOT_FOUND: 'La evaluación no existe.',
          FORBIDDEN: 'Solo un administrador puede anular evaluaciones.',
        };
        setError(mensajes[body.error] ?? body.error ?? 'Error al anular la evaluación.');
        return;
      }
      showSuccess('Evaluación anulada.');
      onAnulada(body.evaluacion);
    } catch {
      setError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Anular evaluación</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="warning">
            La anulación es irreversible. La evaluación seguirá visible en el histórico pero no contará en el
            promedio.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Motivo"
            required
            multiline
            minRows={3}
            size="small"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            helperText={`${motivo.length}/500`}
            autoFocus
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button color="error" variant="contained" onClick={handleAnular} disabled={saving || !motivo.trim()}>
          {saving ? 'Anulando…' : 'Anular'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
