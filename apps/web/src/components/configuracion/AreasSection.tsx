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

interface Area {
  id: string;
  nombre: string;
  activo: boolean;
  creado_en: string;
}

type DialogMode = 'create' | 'edit' | 'delete' | null;

export function AreasSection() {
  const { showSuccess, showError } = useSnackbar();
  const router = useRouter();
  const handleSessionExpired = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login?reason=expired');
  }, [router]);

  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogTarget, setDialogTarget] = useState<Area | null>(null);
  const [nombreInput, setNombreInput] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAreas = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/areas');
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) { showError('Error al cargar áreas.'); return; }
      const data = await res.json();
      setAreas(data.areas);
    } catch {
      showError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired, showError]);

  useEffect(() => { fetchAreas(); }, [fetchAreas]);

  const openCreate = () => {
    setDialogMode('create');
    setDialogTarget(null);
    setNombreInput('');
    setDialogError(null);
  };

  const openEdit = (area: Area) => {
    setDialogMode('edit');
    setDialogTarget(area);
    setNombreInput(area.nombre);
    setDialogError(null);
  };

  const openDelete = (area: Area) => {
    setDialogMode('delete');
    setDialogTarget(area);
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
        isCreate ? '/api/configuracion/areas' : `/api/configuracion/areas/${dialogTarget!.id}`,
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
        setAreas((prev) => [...prev, data.area].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        showSuccess('Área creada.');
      } else {
        setAreas((prev) => prev.map((a) => (a.id === dialogTarget!.id ? data.area : a)));
        showSuccess('Área actualizada.');
      }
      closeDialog();
    } catch {
      setDialogError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (area: Area) => {
    setTogglingId(area.id);
    try {
      const res = await fetch(`/api/configuracion/areas/${area.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !area.activo }),
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showError(data.error ?? 'Error al cambiar estado.'); return; }
      setAreas((prev) => prev.map((a) => (a.id === area.id ? data.area : a)));
      showSuccess(area.activo ? 'Área inactivada.' : 'Área activada.');
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
      const res = await fetch(`/api/configuracion/areas/${dialogTarget.id}`, {
        method: 'DELETE',
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      if (res.status === 204) {
        setAreas((prev) => prev.filter((a) => a.id !== dialogTarget.id));
        showSuccess('Área eliminada.');
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
        <Typography variant="h6">Áreas</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          Nueva área
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
          {areas.map((area) => (
            <TableRow key={area.id} hover>
              <TableCell>{area.nombre}</TableCell>
              <TableCell>
                <Chip
                  label={area.activo ? 'Activa' : 'Inactiva'}
                  color={area.activo ? 'success' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Renombrar">
                  <IconButton size="small" onClick={() => openEdit(area)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={area.activo ? 'Inactivar' : 'Activar'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleActivo(area)}
                      disabled={togglingId === area.id}
                    >
                      {area.activo ? (
                        <ToggleOnIcon fontSize="small" color="success" />
                      ) : (
                        <ToggleOffIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" onClick={() => openDelete(area)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {areas.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                No hay áreas registradas.
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
        <DialogTitle>{dialogMode === 'create' ? 'Nueva área' : 'Renombrar área'}</DialogTitle>
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
        <DialogTitle>Eliminar área</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <Typography>
              ¿Eliminar permanentemente el área <strong>{dialogTarget?.nombre}</strong>?
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
