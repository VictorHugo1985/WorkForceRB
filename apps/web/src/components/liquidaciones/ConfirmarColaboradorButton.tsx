'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';

interface Props {
  liquidacionId: string;
  hasInconsistencias: boolean;
  isConfirmed: boolean;
  onConfirmed: () => void;
}

export function ConfirmarColaboradorButton({ liquidacionId, hasInconsistencias, isConfirmed, onConfirmed }: Props) {
  const [showWarning, setShowWarning] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isConfirmed) {
    return <Chip label="✓ Aprobado" color="success" size="small" />;
  }

  const doConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/liquidaciones/${liquidacionId}/aprobar`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setError(err.message ?? 'Error al confirmar');
        return;
      }
      onConfirmed();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (!hasInconsistencias) {
      doConfirm();
    } else {
      setShowWarning(true);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
      <Button
        variant="contained"
        color="primary"
        size="small"
        onClick={handleClick}
        disabled={loading}
        endIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
      >
        Confirmar
      </Button>

      {showWarning && (
        <Alert severity="warning" sx={{ mt: 1, maxWidth: 480 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Este colaborador tiene días con marcaciones inconsistentes. Confirmar de todas formas sobrescribirá la revisión pendiente.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                size="small"
              />
            }
            label="Reconozco las inconsistencias — confirmar de todas formas"
          />
          <Box sx={{ mt: 1 }}>
            <Button
              variant="contained"
              color="warning"
              size="small"
              disabled={!acknowledged || loading}
              onClick={doConfirm}
              endIcon={loading ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              Confirmar de todas formas
            </Button>
          </Box>
        </Alert>
      )}

      {error && (
        <Typography variant="caption" color="error">{error}</Typography>
      )}
    </Box>
  );
}
