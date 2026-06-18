'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from '@/lib/SnackbarContext';
import type { UsuarioRow } from './UsuariosListClient';

const ROLES = ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'] as const;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

interface ColaboradorOption {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreado: (u: UsuarioRow) => void;
}

export function CrearUsuarioDialog({ open, onClose, onCreado }: Props) {
  const { showSuccess } = useSnackbar();
  const router = useRouter();
  const handleSessionExpired = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login?reason=expired');
  }, [router]);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [colaborador, setColaborador] = useState<ColaboradorOption | null>(null);
  const [colaboradoresOptions, setColaboradoresOptions] = useState<ColaboradorOption[]>([]);
  const [loadingColaboradores, setLoadingColaboradores] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmPassword, setConfirmPassword] = useState<string | null>(null);

  const resetForm = () => {
    setNombre('');
    setApellido('');
    setEmail('');
    setPassword('');
    setShowPass(false);
    setRoles([]);
    setColaborador(null);
    setError(null);
    setConfirmPassword(null);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    setLoadingColaboradores(true);
    fetch('/api/usuarios/colaboradores-disponibles')
      .then((r) => r.json())
      .then((data) => {
        const opts: ColaboradorOption[] = (data.colaboradores ?? []).map(
          (c: { id: string; nombre: string; apellido: string; cedula: string }) => ({
            id: c.id,
            label: `${c.apellido}, ${c.nombre} (${c.cedula})`,
          }),
        );
        setColaboradoresOptions(opts);
      })
      .catch(() => {})
      .finally(() => setLoadingColaboradores(false));
  }, [open]);

  const toggleRol = (r: string) => {
    setRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const passValid = PASSWORD_REGEX.test(password);

  const handleSave = async () => {
    if (!nombre.trim() || !apellido.trim() || !email.trim()) {
      setError('Nombre, apellido y correo son obligatorios.');
      return;
    }
    if (roles.length === 0) {
      setError('Selecciona al menos un rol.');
      return;
    }
    if (!passValid) {
      setError('La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim(),
          password,
          roles,
          colaborador_id: colaborador?.id ?? null,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) { handleSessionExpired(); return; }
        const errData = await res.json().catch(() => ({}));
        setError(errData.message ?? 'Error al crear el usuario.');
        return;
      }
      const data = await res.json();
      setConfirmPassword(password);
      onCreado({
        ...data,
        colaborador_nombre: colaborador
          ? colaboradoresOptions.find((c) => c.id === colaborador.id)?.label ?? null
          : null,
        creado_en: new Date().toISOString(),
      });
    } catch {
      setError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPassword = () => {
    if (confirmPassword) {
      navigator.clipboard.writeText(confirmPassword).catch(() => {});
      showSuccess('Contraseña copiada al portapapeles.');
    }
  };

  const handleCloseConfirm = () => {
    setConfirmPassword(null);
    onClose();
  };

  if (confirmPassword !== null) {
    return (
      <Dialog open onClose={handleCloseConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>Cuenta creada</DialogTitle>
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
              {confirmPassword}
            </Typography>
            <IconButton onClick={handleCopyPassword} size="small">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirm} variant="contained">
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nuevo usuario del sistema</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              size="small"
              required
            />
            <TextField
              label="Apellido"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              fullWidth
              size="small"
              required
            />
          </Box>

          <TextField
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            size="small"
            required
          />

          <TextField
            label="Contraseña inicial"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            size="small"
            required
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

          <Box>
            <FormLabel component="legend" sx={{ mb: 0.5, fontSize: '0.875rem' }}>
              Roles *
            </FormLabel>
            <FormGroup row>
              {ROLES.map((r) => (
                <FormControlLabel
                  key={r}
                  control={
                    <Checkbox
                      checked={roles.includes(r)}
                      onChange={() => toggleRol(r)}
                      size="small"
                    />
                  }
                  label={r}
                />
              ))}
            </FormGroup>
          </Box>

          <Divider />

          <Autocomplete
            options={colaboradoresOptions}
            loading={loadingColaboradores}
            value={colaborador}
            onChange={(_, v) => setColaborador(v)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Vincular a colaborador (opcional)"
                size="small"
              />
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Guardando…' : 'Crear cuenta'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
