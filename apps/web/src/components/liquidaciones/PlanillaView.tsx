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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import { LiquidacionColaborador, type EstadoLiquidacion } from './LiquidacionColaborador';

interface SemanaLaboral {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  tipo_periodo: string | null;
  creado_en: string;
  creado_por: string | null;
  cerrada_en: string | null;
  cerrado_por: string | null;
  monto_total_pagado: number | null;
  cantidad_colaboradores_pagados: number | null;
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

function formatRangoFecha(s: SemanaLaboral) {
  const ini = new Date(s.fecha_inicio.slice(0, 10) + 'T12:00:00Z');
  const fin = new Date(s.fecha_fin.slice(0, 10) + 'T12:00:00Z');
  if (ini.getUTCMonth() === fin.getUTCMonth()) {
    return `${ini.getUTCDate()} – ${fin.getUTCDate()} ${MESES[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;
  }
  return `${ini.getUTCDate()} ${MESES[ini.getUTCMonth()]} – ${fin.getUTCDate()} ${MESES[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;
}

function formatFechaCorta(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function calcFechaFin(fechaInicio: string, tipo: TipoPeriodo): string {
  const d = new Date(fechaInicio + 'T12:00:00Z');
  if (tipo === 'SEMANAL') d.setUTCDate(d.getUTCDate() + 6);
  else if (tipo === 'QUINCENAL') d.setUTCDate(d.getUTCDate() + 14);
  else d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

function estadoChip(estado: string) {
  if (estado === 'ABIERTA') return <Chip label="Abierta" size="small" color="success" />;
  if (estado === 'CERRADA') return <Chip label="Cerrada" size="small" variant="outlined" />;
  return <Chip label={estado} size="small" variant="outlined" />;
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
  const [fechaFinManual, setFechaFinManual] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaFinSugerida = fechaInicio ? calcFechaFin(fechaInicio, tipo) : '';
  const fechaFin = fechaFinManual || fechaFinSugerida;

  const handleTipoChange = (nuevoTipo: TipoPeriodo) => {
    setTipo(nuevoTipo);
  };

  const handleFechaInicioChange = (v: string) => {
    setFechaInicio(v);
    setFechaFinManual('');
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    setFechaInicio('');
    setFechaFinManual('');
    setError(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!fechaInicio) { setError('Seleccione la fecha de inicio'); return; }
    if (!fechaFin || fechaFin < fechaInicio) { setError('La fecha fin debe ser posterior al inicio'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/semanas-laborales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaInicio, fechaFin, tipoPeriodo: tipo }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.message ?? `Error ${res.status}`); return; }
      onCreated({
        id: json.id,
        fecha_inicio: json.fecha_inicio,
        fecha_fin: json.fecha_fin,
        estado: json.estado,
        tipo_periodo: json.tipo_periodo ?? null,
        creado_en: json.creado_en,
        creado_por: json.creado_por ?? null,
        cerrada_en: null,
        cerrado_por: null,
        monto_total_pagado: null,
        cantidad_colaboradores_pagados: null,
      });
      handleClose();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>Crear período de pago</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Tipo de período</InputLabel>
          <Select value={tipo} label="Tipo de período" onChange={(e) => handleTipoChange(e.target.value as TipoPeriodo)} disabled={saving}>
            <MenuItem value="SEMANAL">Semanal (7 días)</MenuItem>
            <MenuItem value="QUINCENAL">Quincenal (15 días)</MenuItem>
            <MenuItem value="MENSUAL">Mensual</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Fecha de inicio"
          type="date"
          size="small"
          fullWidth
          value={fechaInicio}
          onChange={(e) => handleFechaInicioChange(e.target.value)}
          disabled={saving}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <TextField
          label="Fecha de fin"
          type="date"
          size="small"
          fullWidth
          value={fechaFin}
          onChange={(e) => { setFechaFinManual(e.target.value); setError(null); }}
          disabled={saving || !fechaInicio}
          slotProps={{ inputLabel: { shrink: true } }}
          helperText={fechaFinSugerida && !fechaFinManual ? 'Sugerida según tipo de período — editable' : undefined}
        />

        {error && <FormHelperText error sx={{ fontSize: '0.85rem' }}>{error}</FormHelperText>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={saving || !fechaInicio || !fechaFin}
          endIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Crear
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Histórico grid ────────────────────────────────────────────────────────────

interface HistoricoGridProps {
  semanas: SemanaLaboral[];
  onSelect: (semana: SemanaLaboral) => void;
  onNuevoPeriodo: () => void;
}

function HistoricoGrid({ semanas, onSelect, onNuevoPeriodo }: HistoricoGridProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>Períodos de liquidación</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onNuevoPeriodo}>
          Nuevo período
        </Button>
      </Box>

      {semanas.length === 0 ? (
        <Typography color="text.secondary">No hay períodos registrados.</Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Período</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Colaboradores pagados</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Monto total</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Fecha cierre</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Cerrado por</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {semanas.map((s) => (
                <TableRow key={s.id} hover sx={{ cursor: 'pointer' }} onClick={() => onSelect(s)}>
                  <TableCell sx={{ fontWeight: 500 }}>{formatRangoFecha(s)}</TableCell>
                  <TableCell>
                    {s.tipo_periodo
                      ? <Chip label={s.tipo_periodo} size="small" variant="outlined" />
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell>{estadoChip(s.estado)}</TableCell>
                  <TableCell align="right">
                    {s.cantidad_colaboradores_pagados != null
                      ? s.cantidad_colaboradores_pagados
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell align="right">
                    {s.monto_total_pagado != null
                      ? <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {s.monto_total_pagado.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                        </Typography>
                      : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell>
                    {s.cerrada_en ? formatFechaCorta(s.cerrada_en) : <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                  <TableCell>
                    {s.cerrado_por ?? <Typography variant="body2" color="text.disabled">—</Typography>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}

// ── Detail view ────────────────────────────────────────────────────────────────

interface DetailViewProps {
  semana: SemanaLaboral;
  onBack: () => void;
  onUpdate: (semana: SemanaLaboral) => void;
}

function DetailView({ semana, onBack, onUpdate }: DetailViewProps) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Inline date/tipo editing ────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editInicio, setEditInicio] = useState('');
  const [editFin, setEditFin] = useState('');
  const [editTipo, setEditTipo] = useState<TipoPeriodo | ''>('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = () => {
    setEditInicio(semana.fecha_inicio.slice(0, 10));
    setEditFin(semana.fecha_fin.slice(0, 10));
    setEditTipo((semana.tipo_periodo as TipoPeriodo) ?? '');
    setEditError(null);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditError(null); };

  const saveEdit = async () => {
    if (!editInicio || !editFin) { setEditError('Las fechas son requeridas'); return; }
    if (editFin < editInicio) { setEditError('La fecha fin debe ser posterior al inicio'); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/semanas-laborales/${semana.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaInicio: editInicio, fechaFin: editFin, tipoPeriodo: editTipo || null }),
      });
      const json = await res.json();
      if (!res.ok) { setEditError(json?.message ?? `Error ${res.status}`); return; }
      onUpdate({
        ...semana,
        fecha_inicio: json.fecha_inicio,
        fecha_fin: json.fecha_fin,
        tipo_periodo: json.tipo_periodo ?? null,
      });
      setEditing(false);
    } catch {
      setEditError('Error de conexión');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Roster ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setRoster([]);
    fetch(`/api/planilla/${semana.id}`)
      .then((r) => r.json())
      .then((data: { colaboradores: RosterEntry[] }) => setRoster(data.colaboradores ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [semana.id]);

  const handleEstadoChange = useCallback((liquidacionId: string, estado: EstadoLiquidacion) => {
    setRoster((prev) => prev.map((e) => e.liquidacionId === liquidacionId ? { ...e, estado } : e));
  }, []);

  const allDone = roster.length > 0 && roster.every((e) => e.estado === 'APROBADO' || e.estado === 'PAGADO');

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <IconButton size="small" onClick={onBack} aria-label="Volver a períodos">
          <ArrowBackIcon fontSize="small" />
        </IconButton>

        {editing ? (
          /* ── Edit mode ─────────────────────────────────────── */
          <Box sx={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
            <TextField
              label="Fecha inicio"
              type="date"
              size="small"
              value={editInicio}
              onChange={(e) => { setEditInicio(e.target.value); setEditError(null); }}
              disabled={editSaving}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: 160 }}
            />
            <TextField
              label="Fecha fin"
              type="date"
              size="small"
              value={editFin}
              onChange={(e) => { setEditFin(e.target.value); setEditError(null); }}
              disabled={editSaving}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ width: 160 }}
            />
            <FormControl size="small" sx={{ width: 160 }}>
              <InputLabel>Tipo de período</InputLabel>
              <Select
                value={editTipo}
                label="Tipo de período"
                onChange={(e) => setEditTipo(e.target.value as TipoPeriodo | '')}
                disabled={editSaving}
              >
                <MenuItem value=""><em>Sin tipo</em></MenuItem>
                <MenuItem value="SEMANAL">Semanal</MenuItem>
                <MenuItem value="QUINCENAL">Quincenal</MenuItem>
                <MenuItem value="MENSUAL">Mensual</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
              <Tooltip title="Guardar">
                <span>
                  <IconButton size="small" color="primary" onClick={saveEdit} disabled={editSaving}>
                    {editSaving ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Cancelar">
                <IconButton size="small" onClick={cancelEdit} disabled={editSaving}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            {editError && (
              <Typography variant="caption" color="error" sx={{ width: '100%', mt: -0.5 }}>
                {editError}
              </Typography>
            )}
          </Box>
        ) : (
          /* ── Read mode ─────────────────────────────────────── */
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{formatRangoFecha(semana)}</Typography>
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
                {semana.tipo_periodo && <Chip label={semana.tipo_periodo} size="small" variant="outlined" />}
                {estadoChip(semana.estado)}
                {allDone && <Chip label="Período completo" size="small" color="info" />}
              </Box>
            </Box>
            <Tooltip title="Editar fechas">
              <IconButton size="small" onClick={startEdit}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Roster */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : roster.length === 0 ? (
        <Typography color="text.secondary">No hay registros de asistencia para este período.</Typography>
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
                semanaId={semana.id}
                tarifaHora={entry.tarifaHora}
                onEstadoChange={handleEstadoChange}
              />
            ) : null,
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function PlanillaView() {
  const [semanas, setSemanas] = useState<SemanaLaboral[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SemanaLaboral | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch('/api/semanas-laborales')
      .then((r) => r.json())
      .then((rows: SemanaLaboral[]) => {
        setSemanas(rows);
        // Auto-open the most recent ABIERTA period
        const abierta = rows.find((s) => s.estado === 'ABIERTA');
        if (abierta) setSelected(abierta);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePeriodoCreado = useCallback((semana: SemanaLaboral) => {
    setSemanas((prev) => [semana, ...prev].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)));
    setSelected(semana);
    setDialogOpen(false);
  }, []);

  const handlePeriodoUpdated = useCallback((semana: SemanaLaboral) => {
    setSemanas((prev) =>
      prev.map((s) => s.id === semana.id ? semana : s)
        .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)),
    );
    setSelected(semana);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (selected) {
    return (
      <>
        <DetailView semana={selected} onBack={() => setSelected(null)} onUpdate={handlePeriodoUpdated} />
        <CrearPeriodoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={handlePeriodoCreado} />
      </>
    );
  }

  return (
    <>
      <HistoricoGrid
        semanas={semanas}
        onSelect={setSelected}
        onNuevoPeriodo={() => setDialogOpen(true)}
      />
      <CrearPeriodoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={handlePeriodoCreado} />
    </>
  );
}
