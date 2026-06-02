'use client';

import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { LiquidacionColaborador, type EstadoLiquidacion } from './LiquidacionColaborador';

interface SemanaLaboral {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  tipo_periodo: string | null;
}

interface RosterEntry {
  liquidacionId: string | null;
  colaboradorId: string;
  nombre: string;
  apellido: string;
  tarifaHora: number | null;
  estado: string;
}

type TipoPeriodo = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatSemanaLabel(s: SemanaLaboral) {
  const ini = new Date(s.fecha_inicio.slice(0, 10) + 'T12:00:00Z');
  const fin = new Date(s.fecha_fin.slice(0, 10) + 'T12:00:00Z');
  if (ini.getUTCMonth() === fin.getUTCMonth()) {
    return `${ini.getUTCDate()} – ${fin.getUTCDate()} ${MESES[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;
  }
  return `${ini.getUTCDate()} ${MESES[ini.getUTCMonth()]} – ${fin.getUTCDate()} ${MESES[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;
}

function calcFechaFin(fechaInicio: string, tipo: TipoPeriodo): string {
  const d = new Date(fechaInicio + 'T12:00:00Z');
  if (tipo === 'SEMANAL') {
    d.setUTCDate(d.getUTCDate() + 6);
  } else if (tipo === 'QUINCENAL') {
    d.setUTCDate(d.getUTCDate() + 14);
  } else {
    // Last day of the month
    d.setUTCMonth(d.getUTCMonth() + 1, 0);
  }
  return d.toISOString().slice(0, 10);
}

function formatPeriodoLabel(tipo: TipoPeriodo, fechaInicio: string): string {
  const d = new Date(fechaInicio + 'T12:00:00Z');
  if (tipo === 'MENSUAL') {
    return `${MESES_LARGO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return '';
}

// ── Crear Periodo Dialog ──────────────────────────────────────────────────────

interface CrearPeriodoDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (semana: SemanaLaboral) => void;
}

function CrearPeriodoDialog({ open, onClose, onCreated }: CrearPeriodoDialogProps) {
  const [tipo, setTipo] = useState<TipoPeriodo>('SEMANAL');
  const [fechaInicio, setFechaInicio] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaFin = fechaInicio ? calcFechaFin(fechaInicio, tipo) : '';

  const handleClose = () => {
    if (saving) return;
    setFechaInicio('');
    setError(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!fechaInicio) { setError('Seleccione la fecha de inicio'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/semanas-laborales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaInicio,
          fechaFin,
          tipoPeriodo: tipo,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message ?? `Error ${res.status}`);
        return;
      }
      onCreated({
        id: json.id,
        fecha_inicio: json.fecha_inicio,
        fecha_fin: json.fecha_fin,
        estado: json.estado,
        tipo_periodo: json.tipo_periodo ?? null,
      });
      handleClose();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const preview = fechaInicio ? (
    tipo === 'MENSUAL'
      ? formatPeriodoLabel(tipo, fechaInicio)
      : `${fechaInicio} → ${fechaFin}`
  ) : null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Crear período de pago</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Tipo de período</InputLabel>
          <Select
            value={tipo}
            label="Tipo de período"
            onChange={(e) => { setTipo(e.target.value as TipoPeriodo); setFechaInicio(''); }}
            disabled={saving}
          >
            <MenuItem value="SEMANAL">Semanal (7 días)</MenuItem>
            <MenuItem value="QUINCENAL">Quincenal (15 días)</MenuItem>
            <MenuItem value="MENSUAL">Mensual</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label={tipo === 'MENSUAL' ? 'Primer día del mes' : 'Fecha de inicio'}
          type="date"
          size="small"
          fullWidth
          value={fechaInicio}
          onChange={(e) => { setFechaInicio(e.target.value); setError(null); }}
          disabled={saving}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        {preview && (
          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Vista previa
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {tipo === 'MENSUAL' ? preview : `${fechaInicio}  →  ${fechaFin}`}
            </Typography>
            {tipo !== 'MENSUAL' && (
              <Typography variant="caption" color="text.secondary">
                {tipo === 'SEMANAL' ? '7 días' : '15 días'}
              </Typography>
            )}
          </Box>
        )}

        {error && (
          <FormHelperText error sx={{ fontSize: '0.85rem' }}>{error}</FormHelperText>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={saving || !fechaInicio}
          endIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Crear
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function PlanillaView() {
  const [semanas, setSemanas] = useState<SemanaLaboral[]>([]);
  const [semanaIndex, setSemanaIndex] = useState<number>(-1);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loadingSemanas, setLoadingSemanas] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch('/api/semanas-laborales')
      .then((r) => r.json())
      .then((rows: SemanaLaboral[]) => {
        setSemanas(rows);
        const idx = rows.findIndex((s) => s.estado === 'ABIERTA');
        setSemanaIndex(idx >= 0 ? idx : rows.length > 0 ? 0 : -1);
      })
      .catch(() => {})
      .finally(() => setLoadingSemanas(false));
  }, []);

  const semanaActual = semanaIndex >= 0 ? semanas[semanaIndex] : null;

  useEffect(() => {
    if (!semanaActual) return;
    setLoadingRoster(true);
    setRoster([]);
    fetch(`/api/planilla/${semanaActual.id}`)
      .then((r) => r.json())
      .then((data: { colaboradores: RosterEntry[] }) => {
        setRoster(data.colaboradores ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingRoster(false));
  }, [semanaActual]);

  const handleEstadoChange = useCallback((liquidacionId: string, estado: EstadoLiquidacion) => {
    setRoster((prev) =>
      prev.map((e) => e.liquidacionId === liquidacionId ? { ...e, estado } : e),
    );
  }, []);

  const handlePeriodoCreado = useCallback((semana: SemanaLaboral) => {
    setSemanas((prev) => {
      const next = [semana, ...prev].sort(
        (a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio),
      );
      return next;
    });
    // Jump to the newly created period
    setSemanaIndex(0);
  }, []);

  const allDone = roster.length > 0 && roster.every((e) => e.estado === 'APROBADO' || e.estado === 'PAGADO');

  if (loadingSemanas) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Week header ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 3,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <IconButton
          size="small"
          onClick={() => setSemanaIndex((i) => i + 1)}
          disabled={semanaIndex >= semanas.length - 1}
          aria-label="Período anterior"
        >
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>

        <Box sx={{ flex: 1, textAlign: 'center' }}>
          {semanaActual ? (
            <>
              <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                {formatSemanaLabel(semanaActual)}
              </Typography>
              <Box sx={{ mt: 0.25, display: 'flex', justifyContent: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                {semanaActual.tipo_periodo && (
                  <Chip label={semanaActual.tipo_periodo} size="small" variant="outlined" />
                )}
                {semanaActual.estado === 'ABIERTA' ? (
                  <Chip label="Abierta" size="small" color="success" />
                ) : (
                  <Chip label={semanaActual.estado} size="small" variant="outlined" />
                )}
                {allDone && (
                  <Chip label="Período completo" size="small" color="info" />
                )}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary">Sin períodos registrados</Typography>
          )}
        </Box>

        <IconButton
          size="small"
          onClick={() => setSemanaIndex((i) => i - 1)}
          disabled={semanaIndex <= 0}
          aria-label="Período siguiente"
        >
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>

        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ ml: 1, whiteSpace: 'nowrap' }}
        >
          Nuevo período
        </Button>
      </Box>

      {/* ── Collaborator blocks ── */}
      {loadingRoster ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : roster.length === 0 ? (
        <Typography color="text.secondary">
          No hay registros de asistencia para este período.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {roster.map((entry) =>
            entry.liquidacionId ? (
              <LiquidacionColaborador
                key={entry.liquidacionId}
                liquidacionId={entry.liquidacionId}
                colaboradorId={entry.colaboradorId}
                nombre={entry.nombre}
                apellido={entry.apellido}
                semanaId={semanaActual!.id}
                tarifaHora={entry.tarifaHora}
                onEstadoChange={handleEstadoChange}
              />
            ) : null,
          )}
        </Box>
      )}

      <CrearPeriodoDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handlePeriodoCreado}
      />
    </Box>
  );
}
