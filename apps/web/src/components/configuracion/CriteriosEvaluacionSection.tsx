'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import BalanceIcon from '@mui/icons-material/Balance';
import EditIcon from '@mui/icons-material/Edit';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import { useSnackbar } from '@/lib/SnackbarContext';
import type { CriterioEvaluacion, CriteriosResponse } from '@/lib/evaluaciones-types';

type DialogMode = 'create' | 'edit' | null;

const toCent = (v: string | number) => Math.round(Number(v) * 100);
const fmt = (cent: number) => (cent / 100).toFixed(2);

export function CriteriosEvaluacionSection() {
  const { showSuccess, showError } = useSnackbar();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleSessionExpired = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login?reason=expired');
  }, [router]);

  const [data, setData] = useState<CriteriosResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Crear / editar
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [target, setTarget] = useState<CriterioEvaluacion | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', peso: '' });
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Redistribuir
  const [redistOpen, setRedistOpen] = useState(false);
  const [redistPesos, setRedistPesos] = useState<Record<string, string>>({});
  const [redistError, setRedistError] = useState<string | null>(null);

  const fetchCriterios = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/criterios-evaluacion');
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) { showError('Error al cargar los criterios de evaluación.'); return; }
      setData(await res.json());
    } catch {
      showError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired, showError]);

  useEffect(() => { fetchCriterios(); }, [fetchCriterios]);

  const activos = useMemo(() => (data?.criterios ?? []).filter((c) => c.activo), [data]);

  const openCreate = () => {
    setDialogMode('create');
    setTarget(null);
    setForm({ nombre: '', descripcion: '', peso: '' });
    setDialogError(null);
  };

  const openEdit = (c: CriterioEvaluacion) => {
    setDialogMode('edit');
    setTarget(c);
    setForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', peso: Number(c.peso).toString() });
    setDialogError(null);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogMode(null);
    setTarget(null);
    setDialogError(null);
  };

  const handleSave = async () => {
    const nombre = form.nombre.trim();
    const peso = Number(form.peso);
    if (!nombre) { setDialogError('El nombre es obligatorio.'); return; }
    if (!form.peso || Number.isNaN(peso) || peso <= 0 || peso > 100) {
      setDialogError('El peso debe ser mayor a 0% y como máximo 100%.');
      return;
    }
    setSaving(true);
    setDialogError(null);
    try {
      const isCreate = dialogMode === 'create';
      const res = await fetch(
        isCreate
          ? '/api/configuracion/criterios-evaluacion'
          : `/api/configuracion/criterios-evaluacion/${target!.id}`,
        {
          method: isCreate ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, descripcion: form.descripcion.trim() || null, peso }),
        },
      );
      if (res.status === 401) { handleSessionExpired(); return; }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setDialogError(body.error ?? 'Error al guardar.'); return; }
      showSuccess(isCreate ? 'Criterio creado.' : 'Criterio actualizado.');
      setDialogMode(null);
      await fetchCriterios();
    } catch {
      setDialogError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: CriterioEvaluacion) => {
    setTogglingId(c.id);
    try {
      const res = await fetch(`/api/configuracion/criterios-evaluacion/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !c.activo }),
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { showError(body.error ?? 'Error al cambiar el estado.'); return; }
      showSuccess(c.activo ? 'Criterio desactivado.' : 'Criterio activado.');
      await fetchCriterios();
    } catch {
      showError('Error de conexión.');
    } finally {
      setTogglingId(null);
    }
  };

  const openRedistribuir = () => {
    setRedistPesos(Object.fromEntries(activos.map((c) => [c.id, Number(c.peso).toString()])));
    setRedistError(null);
    setRedistOpen(true);
  };

  const redistSuma = useMemo(
    () => Object.values(redistPesos).reduce((acc, v) => acc + (Number(v) > 0 ? toCent(v) : 0), 0),
    [redistPesos],
  );
  const redistValido =
    redistSuma === 10000 && Object.values(redistPesos).every((v) => Number(v) > 0 && Number(v) <= 100);

  const handleRedistribuir = async () => {
    setSaving(true);
    setRedistError(null);
    try {
      const res = await fetch('/api/configuracion/criterios-evaluacion/pesos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pesos: Object.entries(redistPesos).map(([id, peso]) => ({ id, peso: Number(peso) })),
        }),
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setRedistError(body.error ?? 'Error al guardar los pesos.'); return; }
      setData(body);
      showSuccess('Pesos actualizados.');
      setRedistOpen(false);
    } catch {
      setRedistError('Error de conexión.');
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

  const valida = data?.configuracion_valida ?? false;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1,
          mb: 2,
        }}
      >
        <Typography variant="h6">Criterios de evaluación</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<BalanceIcon />}
            onClick={openRedistribuir}
            disabled={activos.length === 0}
          >
            Redistribuir pesos
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
            Nuevo criterio
          </Button>
        </Box>
      </Box>

      <Paper
        variant="outlined"
        sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
      >
        <Typography variant="body2">
          Suma de pesos activos: <strong>{data?.suma_activos ?? '0.00'}%</strong> de 100%
        </Typography>
        {valida ? (
          <Chip label="Configuración válida" color="success" size="small" />
        ) : (
          <Chip
            label="Los pesos deben sumar 100% para registrar evaluaciones"
            color="warning"
            size="small"
            sx={{ maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal' }, height: 'auto', py: 0.25 }}
          />
        )}
      </Paper>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              {!isMobile && <TableCell>Descripción</TableCell>}
              <TableCell align="right">Peso</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.criterios ?? []).map((c) => (
              <TableRow key={c.id} hover sx={{ opacity: c.activo ? 1 : 0.6 }}>
                <TableCell>{c.nombre}</TableCell>
                {!isMobile && (
                  <TableCell sx={{ color: 'text.secondary' }}>{c.descripcion ?? '—'}</TableCell>
                )}
                <TableCell align="right">{c.peso}%</TableCell>
                <TableCell>
                  <Chip
                    label={c.activo ? 'Activo' : 'Inactivo'}
                    color={c.activo ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => openEdit(c)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={c.activo ? 'Desactivar' : 'Activar'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => handleToggle(c)}
                        disabled={togglingId === c.id}
                      >
                        {c.activo ? (
                          <ToggleOnIcon fontSize="small" color="success" />
                        ) : (
                          <ToggleOffIcon fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {(data?.criterios ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No hay criterios de evaluación registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Los cambios en criterios o pesos no modifican las evaluaciones ya registradas.
      </Typography>

      {/* Crear / editar */}
      <Dialog open={dialogMode !== null} onClose={closeDialog} maxWidth="xs" fullWidth fullScreen={isMobile}>
        <DialogTitle>{dialogMode === 'create' ? 'Nuevo criterio' : 'Editar criterio'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dialogError && <Alert severity="error">{dialogError}</Alert>}
            <TextField
              label="Nombre"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              fullWidth
              size="small"
              autoFocus
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            <TextField
              label="Descripción (opcional)"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              fullWidth
              size="small"
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            <TextField
              label="Peso"
              type="number"
              value={form.peso}
              onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
              fullWidth
              size="small"
              slotProps={{
                htmlInput: { min: 0.01, max: 100, step: 0.01 },
                input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
              }}
              helperText="Mayor a 0% y hasta 100%, con hasta dos decimales."
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

      {/* Redistribuir pesos */}
      <Dialog
        open={redistOpen}
        onClose={saving ? undefined : () => setRedistOpen(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Redistribuir pesos</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {redistError && <Alert severity="error">{redistError}</Alert>}
            {activos.map((c) => (
              <TextField
                key={c.id}
                label={c.nombre}
                type="number"
                size="small"
                value={redistPesos[c.id] ?? ''}
                onChange={(e) => setRedistPesos((p) => ({ ...p, [c.id]: e.target.value }))}
                slotProps={{
                  htmlInput: { min: 0.01, max: 100, step: 0.01 },
                  input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                }}
              />
            ))}
            <Alert severity={redistValido ? 'success' : 'warning'}>
              Suma: <strong>{fmt(redistSuma)}%</strong>
              {redistValido ? '' : ' — debe ser exactamente 100% y cada peso mayor a 0%.'}
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRedistOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleRedistribuir} variant="contained" disabled={saving || !redistValido}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
