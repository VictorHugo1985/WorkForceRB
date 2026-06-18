'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSnackbar } from '@/lib/SnackbarContext';

interface DispositivoRow {
  id: string;
  nombre: string;
  numero_serie: string | null;
  tipo: 'WEBHOOK' | 'CSV';
  activo: boolean;
  tiene_webhook_secreto: boolean;
  creado_en: string;
  actualizado_en: string;
}

interface Props {
  dispositivos: DispositivoRow[];
  isAdmin: boolean;
}

export function RelojesListClient({ dispositivos: initial, isAdmin }: Props) {
  const { showSuccess, showError } = useSnackbar();
  const [dispositivos, setDispositivos] = useState<DispositivoRow[]>(initial);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [cNombre, setCNombre] = useState('');
  const [cNumeroSerie, setCNumeroSerie] = useState('');
  const [cTipo, setCTipo] = useState<'WEBHOOK' | 'CSV'>('WEBHOOK');
  const [cSecreto, setCSecreto] = useState('');

  // Edit dialog
  const [editTarget, setEditTarget] = useState<DispositivoRow | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [eNombre, setENombre] = useState('');
  const [eNumeroSerie, setENumeroSerie] = useState('');
  const [eTipo, setETipo] = useState<'WEBHOOK' | 'CSV'>('WEBHOOK');
  const [eSecreto, setESecreto] = useState('');

  // Toggle active
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setCNombre(''); setCNumeroSerie(''); setCTipo('WEBHOOK'); setCSecreto('');
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!cNombre.trim()) { setCreateError('El nombre es requerido'); return; }
    if (cTipo === 'WEBHOOK' && !cSecreto.trim()) { setCreateError('El secreto webhook es requerido'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/dispositivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: cNombre.trim(),
          numero_serie: cNumeroSerie.trim() || undefined,
          tipo: cTipo,
          webhook_secreto: cTipo === 'WEBHOOK' ? cSecreto : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json?.message ?? `Error ${res.status}`); return; }
      setDispositivos((prev) => [...prev, json].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCreateOpen(false);
      showSuccess('Reloj biométrico registrado.');
    } catch {
      setCreateError('Error de red. Intente de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (d: DispositivoRow) => {
    setEditTarget(d);
    setENombre(d.nombre);
    setENumeroSerie(d.numero_serie ?? '');
    setETipo(d.tipo);
    setESecreto('');
    setEditError(null);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setEditError(null);
    if (!eNombre.trim()) { setEditError('El nombre es requerido'); return; }
    setEditing(true);
    try {
      const res = await fetch(`/api/dispositivos/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: eNombre.trim(),
          numero_serie: eNumeroSerie.trim() || null,
          tipo: eTipo,
          webhook_secreto: eSecreto.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setEditError(json?.message ?? `Error ${res.status}`); return; }
      setDispositivos((prev) => prev.map((d) => d.id === editTarget.id ? { ...d, ...json } : d));
      setEditTarget(null);
      showSuccess('Reloj actualizado.');
    } catch {
      setEditError('Error de red. Intente de nuevo.');
    } finally {
      setEditing(false);
    }
  };

  const handleToggleActive = async (d: DispositivoRow) => {
    setTogglingId(d.id);
    try {
      const res = await fetch(`/api/dispositivos/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !d.activo }),
      });
      if (res.ok) {
        const json = await res.json();
        setDispositivos((prev) => prev.map((r) => r.id === d.id ? { ...r, activo: json.activo } : r));
        showSuccess(d.activo ? 'Reloj inactivado.' : 'Reloj activado.');
      } else {
        const json = await res.json().catch(() => ({}));
        showError(json?.message ?? 'No se pudo cambiar el estado.');
      }
    } catch {
      showError('Error de red. Intente de nuevo.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Configuración Reloj"
        action={
          isAdmin ? (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={handleOpenCreate}>
              Nuevo Reloj
            </Button>
          ) : undefined
        }
      />

      {dispositivos.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 6, color: 'text.secondary' }}>
          <AccessTimeIcon sx={{ fontSize: 48, opacity: 0.3 }} />
          <Typography>No hay relojes biométricos registrados.</Typography>
        </Box>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>N.º de serie</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Secreto</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dispositivos.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{d.nombre}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{d.numero_serie ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={d.tipo}
                      size="small"
                      color={d.tipo === 'WEBHOOK' ? 'primary' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {d.tipo === 'WEBHOOK' && (
                      <Tooltip title={d.tiene_webhook_secreto ? 'Secreto configurado' : 'Sin secreto'}>
                        <KeyIcon
                          fontSize="small"
                          sx={{ verticalAlign: 'middle', color: d.tiene_webhook_secreto ? 'success.main' : 'text.disabled' }}
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.activo
                      ? <Chip label="Activo" size="small" color="success" />
                      : <Chip label="Inactivo" size="small" color="default" />}
                  </TableCell>
                  <TableCell align="right">
                    {isAdmin && (
                      <>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleOpenEdit(d)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={d.activo ? 'Inactivar' : 'Activar'}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleActive(d)}
                            disabled={togglingId === d.id}
                          >
                            {d.activo
                              ? <LockOpenIcon fontSize="small" />
                              : <LockIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); setCreateError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Nuevo Reloj Biométrico</DialogTitle>
        <DialogContent>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Nombre"
              size="small"
              value={cNombre}
              onChange={(e) => setCNombre(e.target.value)}
              required
            />
            <TextField
              label="Número de serie"
              size="small"
              value={cNumeroSerie}
              onChange={(e) => setCNumeroSerie(e.target.value)}
              helperText="Opcional"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Tipo de integración</InputLabel>
              <Select
                label="Tipo de integración"
                value={cTipo}
                onChange={(e) => setCTipo(e.target.value as 'WEBHOOK' | 'CSV')}
              >
                <MenuItem value="WEBHOOK">WEBHOOK (tiempo real)</MenuItem>
                <MenuItem value="CSV">CSV (importación manual)</MenuItem>
              </Select>
            </FormControl>
            {cTipo === 'WEBHOOK' && (
              <TextField
                label="Secreto webhook"
                size="small"
                type="password"
                value={cSecreto}
                onChange={(e) => setCSecreto(e.target.value)}
                required
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setCreateError(null); }} disabled={creating}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editTarget !== null} onClose={() => { setEditTarget(null); setEditError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Editar Reloj Biométrico</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Nombre"
              size="small"
              value={eNombre}
              onChange={(e) => setENombre(e.target.value)}
              required
            />
            <TextField
              label="Número de serie"
              size="small"
              value={eNumeroSerie}
              onChange={(e) => setENumeroSerie(e.target.value)}
              helperText="Dejar vacío para quitar el número de serie"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Tipo de integración</InputLabel>
              <Select
                label="Tipo de integración"
                value={eTipo}
                onChange={(e) => setETipo(e.target.value as 'WEBHOOK' | 'CSV')}
              >
                <MenuItem value="WEBHOOK">WEBHOOK (tiempo real)</MenuItem>
                <MenuItem value="CSV">CSV (importación manual)</MenuItem>
              </Select>
            </FormControl>
            {eTipo === 'WEBHOOK' && (
              <TextField
                label="Secreto webhook"
                size="small"
                type="password"
                value={eSecreto}
                onChange={(e) => setESecreto(e.target.value)}
                helperText="Dejar vacío para conservar el secreto actual"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditTarget(null); setEditError(null); }} disabled={editing}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleEdit} disabled={editing}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
