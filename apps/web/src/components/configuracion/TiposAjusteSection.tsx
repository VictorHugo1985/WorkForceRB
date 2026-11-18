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
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import { useSnackbar } from '@/lib/SnackbarContext';

interface TipoAjuste {
  id: string;
  nombre: string;
  activo: boolean;
  creado_en: string;
}

type DialogMode = 'create' | 'edit' | 'delete' | null;

export function TiposAjusteSection() {
  const { showSuccess, showError } = useSnackbar();
  const router = useRouter();
  const handleSessionExpired = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login?reason=expired');
  }, [router]);

  const [tipos, setTipos] = useState<TipoAjuste[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogTarget, setDialogTarget] = useState<TipoAjuste | null>(null);
  const [nombreInput, setNombreInput] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchTipos = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/tipos-ajuste');
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) { showError('Error al cargar tipos de ajuste.'); return; }
      const data = await res.json();
      setTipos(data.tiposAjuste);
    } catch {
      showError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired, showError]);

  useEffect(() => { fetchTipos(); }, [fetchTipos]);

  const openCreate = () => {
    setDialogMode('create');
    setDialogTarget(null);
    setNombreInput('');
    setDialogError(null);
  };

  const openEdit = (tipo: TipoAjuste) => {
    setDialogMode('edit');
    setDialogTarget(tipo);
    setNombreInput(tipo.nombre);
    setDialogError(null);
  };

  const openDelete = (tipo: TipoAjuste) => {
    setDialogMode('delete');
    setDialogTarget(tipo);
    setDialogError(null);
  };

  const closeDialog = () => {
    setDialogMode(null);
    setDialogTarget(null);
    setNombreInput('');
    setDialogError(null);
  };

  const handleSave = async () => {
    const nombre = nombreInput.trim();
    if (!nombre) { setDialogError('El nombre es obligatorio.'); return; }
    setDialogError(null);
    setSaving(true);
    try {
      const isCreate = dialogMode === 'create';
      const res = await fetch(
        isCreate ? '/api/configuracion/tipos-ajuste' : `/api/configuracion/tipos-ajuste/${dialogTarget!.id}`,
        {
          method: isCreate ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre }),
        },
      );
      if (res.status === 401) { handleSessionExpired(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setDialogError(data.error ?? 'Error al guardar.'); return; }
      if (isCreate) {
        setTipos((prev) =>
          [...prev, data.tipoAjuste].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
        showSuccess('Tipo de ajuste creado.');
      } else {
        setTipos((prev) =>
          prev.map((t) => (t.id === dialogTarget!.id ? data.tipoAjuste : t)),
        );
        showSuccess('Tipo de ajuste actualizado.');
      }
      closeDialog();
    } catch {
      setDialogError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (tipo: TipoAjuste) => {
    setTogglingId(tipo.id);
    try {
      const res = await fetch(`/api/configuracion/tipos-ajuste/${tipo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !tipo.activo }),
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showError(data.error ?? 'Error al cambiar estado.'); return; }
      setTipos((prev) => prev.map((t) => (t.id === tipo.id ? data.tipoAjuste : t)));
      showSuccess(tipo.activo ? 'Tipo inactivado.' : 'Tipo activado.');
    } catch {
      showError('Error de conexión.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!dialogTarget) return;
    setSaving(true);
    setDialogError(null);
    try {
      const res = await fetch(`/api/configuracion/tipos-ajuste/${dialogTarget.id}`, {
        method: 'DELETE',
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      if (res.status === 204) {
        setTipos((prev) => prev.filter((t) => t.id !== dialogTarget.id));
        showSuccess('Tipo de ajuste eliminado.');
        closeDialog();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setDialogError(data.error ?? 'Error al eliminar.');
    } catch {
      setDialogError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Tipos de Ajuste</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          Nuevo tipo
        </Button>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nombre</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tipos.map((tipo) => (
            <TableRow key={tipo.id} hover>
              <TableCell>{tipo.nombre}</TableCell>
              <TableCell>
                <Chip
                  label={tipo.activo ? 'Activo' : 'Inactivo'}
                  color={tipo.activo ? 'success' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Renombrar">
                  <IconButton size="small" onClick={() => openEdit(tipo)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={tipo.activo ? 'Inactivar' : 'Activar'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleActivo(tipo)}
                      disabled={togglingId === tipo.id}
                    >
                      {tipo.activo ? (
                        <ToggleOnIcon fontSize="small" color="success" />
                      ) : (
                        <ToggleOffIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" onClick={() => openDelete(tipo)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {tipos.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No hay tipos de ajuste registrados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogMode === 'create' || dialogMode === 'edit'}
        onClose={saving ? undefined : closeDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' ? 'Nuevo tipo de ajuste' : 'Renombrar tipo de ajuste'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <TextField
              label="Nombre"
              value={nombreInput}
              onChange={(e) => setNombreInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              fullWidth
              size="small"
              autoFocus
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={dialogMode === 'delete'}
        onClose={saving ? undefined : closeDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Eliminar tipo de ajuste</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <Typography>
              ¿Eliminar permanentemente <strong>{dialogTarget?.nombre}</strong>?
              Esta acción no se puede deshacer.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancelar</Button>
          <Button onClick={handleDelete} variant="contained" color="error" disabled={saving}>
            {saving ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
