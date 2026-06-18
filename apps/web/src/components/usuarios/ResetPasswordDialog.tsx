'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from '@/lib/SnackbarContext';
import type { UsuarioRow } from './UsuariosListClient';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

interface Props {
  open: boolean;
  usuario: UsuarioRow;
  onClose: () => void;
}

export function ResetPasswordDialog({ open, usuario, onClose }: Props) {
  const { showSuccess } = useSnackbar();
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmedPassword, setConfirmedPassword] = useState<string | null>(null);

  const passValid = PASSWORD_REGEX.test(password);

  const handleSave = async () => {
    if (!passValid) {
      setError('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Error al resetear la contraseña.');
        return;
      }
      setConfirmedPassword(password);
    } catch {
      setError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (confirmedPassword) {
      navigator.clipboard.writeText(confirmedPassword).catch(() => {});
      showSuccess('Contraseña copiada al portapapeles.');
    }
  };

  const handleClose = () => {
    setPassword('');
    setShowPass(false);
    setError(null);
    setConfirmedPassword(null);
    onClose();
  };

  if (confirmedPassword !== null) {
    return (
      <Dialog open onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Contraseña reseteada</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta contraseña no se mostrará nuevamente. Comunícala al usuario de forma segura.
          </Alert>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'grey.100',
              borderRadius: 1,
              px: 2,
              py: 1,
            }}
          >
            <Typography variant="body1" sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
              {confirmedPassword}
            </Typography>
            <IconButton onClick={handleCopy} size="small">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} variant="contained">
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Resetear contraseña — {usuario.nombre} {usuario.apellido}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Nueva contraseña"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            size="small"
            helperText="Mínimo 8 caracteres, una mayúscula, una minúscula y un número"
            error={password.length > 0 && !passValid}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass((v) => !v)} size="small" edge="end">
                      {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Guardando…' : 'Resetear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
