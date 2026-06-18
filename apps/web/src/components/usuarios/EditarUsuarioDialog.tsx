'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import { useSnackbar } from '@/lib/SnackbarContext';
import type { UsuarioRow } from './UsuariosListClient';

const ROLES = ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'] as const;

interface ColaboradorOption {
  id: string;
  label: string;
}

interface Props {
  open: boolean;
  usuario: UsuarioRow;
  onClose: () => void;
  onEditado: (u: UsuarioRow) => void;
}

export function EditarUsuarioDialog({ open, usuario, onClose, onEditado }: Props) {
  const { showSuccess, showError } = useSnackbar();
  const router = useRouter();
  const handleSessionExpired = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login?reason=expired');
  }, [router]);
  const [tab, setTab] = useState(0);

  const [nombre, setNombre] = useState(usuario.nombre);
  const [apellido, setApellido] = useState(usuario.apellido);
  const [colaborador, setColaborador] = useState<ColaboradorOption | null>(null);
  const [colaboradoresOptions, setColaboradoresOptions] = useState<ColaboradorOption[]>([]);
  const [loadingColaboradores, setLoadingColaboradores] = useState(false);
  const [savingDatos, setSavingDatos] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);

  const [roles, setRoles] = useState<string[]>(usuario.roles);
  const [savingRoles, setSavingRoles] = useState(false);
  const [errorRoles, setErrorRoles] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNombre(usuario.nombre);
    setApellido(usuario.apellido);
    setRoles(usuario.roles);
    setErrorDatos(null);
    setErrorRoles(null);
    setTab(0);

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
        if (usuario.colaborador_id) {
          const current = opts.find((o) => o.id === usuario.colaborador_id);
          if (current) {
            setColaborador(current);
          } else if (usuario.colaborador_nombre) {
            const fallback = { id: usuario.colaborador_id, label: usuario.colaborador_nombre };
            opts.unshift(fallback);
            setColaborador(fallback);
          }
        } else {
          setColaborador(null);
        }
        setColaboradoresOptions(opts);
      })
      .catch(() => {})
      .finally(() => setLoadingColaboradores(false));
  }, [open, usuario]);

  const toggleRol = (r: string) => {
    setRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const handleSaveDatos = async () => {
    if (!nombre.trim() || !apellido.trim()) {
      setErrorDatos('Nombre y apellido son obligatorios.');
      return;
    }
    setErrorDatos(null);
    setSavingDatos(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          colaborador_id: colaborador?.id ?? null,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) { handleSessionExpired(); return; }
        const data = await res.json().catch(() => ({}));
        setErrorDatos(data.message ?? 'Error al guardar.');
        return;
      }
      showSuccess('Datos actualizados.');
      onEditado({
        ...usuario,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        colaborador_id: colaborador?.id ?? null,
        colaborador_nombre: colaborador?.label ?? null,
      });
    } catch {
      setErrorDatos('Error de conexión.');
    } finally {
      setSavingDatos(false);
    }
  };

  const handleSaveRoles = async () => {
    if (roles.length === 0) {
      setErrorRoles('El usuario debe tener al menos un rol.');
      return;
    }
    setErrorRoles(null);
    setSavingRoles(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles }),
      });
      if (!res.ok) {
        if (res.status === 401) { handleSessionExpired(); return; }
        const data = await res.json().catch(() => ({}));
        setErrorRoles(data.message ?? 'Error al actualizar roles.');
        return;
      }
      showSuccess('Roles actualizados. El usuario deberá volver a iniciar sesión.');
      onEditado({ ...usuario, roles });
    } catch {
      setErrorRoles('Error de conexión.');
    } finally {
      setSavingRoles(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Editar — {usuario.apellido}, {usuario.nombre}
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Datos" />
        <Tab label="Roles" />
      </Tabs>
      <DialogContent>
        {tab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {errorDatos && <Alert severity="error">{errorDatos}</Alert>}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                fullWidth
                size="small"
              />
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
                  label="Colaborador vinculado (opcional)"
                  size="small"
                />
              )}
            />
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {errorRoles && <Alert severity="error">{errorRoles}</Alert>}
            <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
              Al guardar los roles, el usuario deberá volver a iniciar sesión.
            </Alert>
            <Box>
              <FormLabel component="legend" sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                Roles asignados
              </FormLabel>
              <FormGroup>
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
              {roles.length === 0 && (
                <FormHelperText error>Selecciona al menos un rol</FormHelperText>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={savingDatos || savingRoles}>
          Cerrar
        </Button>
        {tab === 0 && (
          <Button onClick={handleSaveDatos} variant="contained" disabled={savingDatos}>
            {savingDatos ? 'Guardando…' : 'Guardar datos'}
          </Button>
        )}
        {tab === 1 && (
          <Button onClick={handleSaveRoles} variant="contained" disabled={savingRoles}>
            {savingRoles ? 'Guardando…' : 'Guardar roles'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
