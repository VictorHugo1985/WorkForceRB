'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSnackbar } from '@/lib/SnackbarContext';

interface SemanaLaboral {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  creado_en: string;
}

interface Props {
  semanas: SemanaLaboral[];
  isAdmin: boolean;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const PERIODOS = [
  { label: 'Semanal (7 días)',    days: 6  },
  { label: 'Bisemanal (14 días)', days: 13 },
  { label: 'Mensual (30 días)',   days: 29 },
  { label: 'Personalizado',       days: -1 },
] as const;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SemanasListClient({ semanas: initial, isAdmin }: Props) {
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();
  const [semanas, setSemanas] = useState<SemanaLaboral[]>(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [periodo, setPeriodo] = useState<number>(6);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const isCustom = periodo === -1;

  const handleFechaInicioChange = (val: string) => {
    setFechaInicio(val);
    if (val && !isCustom) setFechaFin(addDays(val, periodo));
  };

  const handlePeriodoChange = (days: number) => {
    setPeriodo(days);
    if (fechaInicio && days !== -1) setFechaFin(addDays(fechaInicio, days));
    if (days === -1) setFechaFin('');
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!fechaInicio || !fechaFin) {
      setCreateError('Las fechas son requeridas');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/semanas-laborales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaInicio, fechaFin }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.message ?? `Error ${res.status}`;
        setCreateError(msg);
        showError(`No se pudo crear el período: ${msg}`);
        return;
      }
      setSemanas((prev) => [json, ...prev]);
      setCreateOpen(false);
      setFechaInicio('');
      setFechaFin('');
      setPeriodo(6);
      showSuccess('Período laboral creado.');
    } catch {
      const msg = 'Error de red. Intente de nuevo.';
      setCreateError(msg);
      showError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleCerrar = async (semana: SemanaLaboral) => {
    if (!confirm(`¿Cerrar la semana ${formatDate(semana.fecha_inicio)} – ${formatDate(semana.fecha_fin)}? Esta acción no se puede deshacer.`)) return;
    setClosingId(semana.id);
    try {
      const res = await fetch(`/api/semanas-laborales/${semana.id}/cerrar`, { method: 'PATCH' });
      if (res.ok) {
        const json = await res.json();
        setSemanas((prev) => prev.map((s) => (s.id === semana.id ? { ...s, ...json } : s)));
        showSuccess('Semana cerrada correctamente.');
      } else {
        const json = await res.json().catch(() => ({}));
        showError(json?.message ?? 'No se pudo cerrar la semana.');
      }
    } catch {
      showError('Error de red. Intente de nuevo.');
    } finally {
      setClosingId(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Semanas Laborales"
        action={
          isAdmin ? (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Nueva Semana
            </Button>
          ) : undefined
        }
      />

      {semanas.length === 0 ? (
        <Typography color="text.secondary">No hay semanas laborales registradas.</Typography>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Período</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Creada</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {semanas.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {formatDate(s.fecha_inicio)} – {formatDate(s.fecha_fin)}
                  </TableCell>
                  <TableCell>
                    {s.estado === 'ABIERTA' ? (
                      <Chip label="Abierta" size="small" color="success" />
                    ) : (
                      <Chip label="Cerrada" size="small" color="default" />
                    )}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                    {new Date(s.creado_en).toLocaleDateString('es-VE')}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Ver liquidaciones">
                      <IconButton
                        size="small"
                        onClick={() => router.push(`/liquidaciones?semana_id=${s.id}`)}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && s.estado === 'ABIERTA' && (
                      <Tooltip title="Cerrar semana">
                        <IconButton
                          size="small"
                          onClick={() => handleCerrar(s)}
                          disabled={closingId === s.id}
                        >
                          <LockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
          setFechaInicio('');
          setFechaFin('');
          setPeriodo(6);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Nuevo Período Laboral</DialogTitle>
        <DialogContent>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Tipo de período</InputLabel>
              <Select
                label="Tipo de período"
                value={periodo}
                onChange={(e) => handlePeriodoChange(Number(e.target.value))}
              >
                {PERIODOS.map((p) => (
                  <MenuItem key={p.days} value={p.days}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Fecha inicio"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={fechaInicio}
              onChange={(e) => handleFechaInicioChange(e.target.value)}
            />
            <TextField
              label="Fecha fin"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              disabled={!isCustom && !fechaInicio}
              helperText={!isCustom && fechaInicio ? 'Calculada automáticamente' : undefined}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateOpen(false);
              setCreateError(null);
              setFechaInicio('');
              setFechaFin('');
              setPeriodo(6);
            }}
            disabled={creating}
          >
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating || !fechaInicio || !fechaFin}>
            Crear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
