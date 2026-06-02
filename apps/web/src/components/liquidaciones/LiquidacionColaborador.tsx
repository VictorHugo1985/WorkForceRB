'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import type { DiaLiquidacionData, LiquidacionData, TotalesData } from '@/stores/liquidacion.store';
import { PlanillaDiaRow } from './PlanillaDiaRow';
import { ConfirmarColaboradorButton } from './ConfirmarColaboradorButton';

interface Props {
  liquidacionId: string;
  colaboradorId: string;
  nombre: string;
  apellido: string;
  semanaId: string;
  tarifaHora: number | null;
  onEstadoChange: (liquidacionId: string, estado: 'APROBADO') => void;
}

// ── Inline tarifa editor ──────────────────────────────────────────────────────

interface TarifaEditorProps {
  colaboradorId: string;
  value: number | null;
  onChange: (newValue: number) => void;
}

function TarifaEditor({ colaboradorId, value, onChange }: TarifaEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value !== null ? String(value) : '');
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const save = async () => {
    const num = parseFloat(draft);
    if (isNaN(num) || num <= 0) { setError('Valor inválido'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/colaboradores/${colaboradorId}/tarifa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: num }),
      });
      if (res.status === 403) { setError('Sin permisos'); return; }
      if (!res.ok) { setError('Error al guardar'); return; }
      onChange(num);
      setEditing(false);
    } catch {
      setError('Error de red');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  if (editing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TextField
          inputRef={inputRef}
          size="small"
          type="number"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          error={!!error}
          helperText={error}
          sx={{ width: 110 }}
          slotProps={{
            htmlInput: { step: 0.5, min: 0.01 },
            input: { endAdornment: <InputAdornment position="end">Bs./h</InputAdornment> },
          }}
          disabled={saving}
          autoFocus
        />
        <IconButton size="small" onClick={save} disabled={saving} color="primary">
          {saving ? <CircularProgress size={14} /> : <CheckIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={cancel} disabled={saving}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {value !== null ? `${value.toFixed(2)} Bs./h` : '— Bs./h'}
      </Typography>
      <Tooltip title="Editar tarifa/hora">
        <IconButton size="small" onClick={startEdit} sx={{ p: 0.25 }}>
          <EditIcon sx={{ fontSize: 13 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LiquidacionColaborador({
  liquidacionId,
  colaboradorId,
  nombre,
  apellido,
  tarifaHora,
  onEstadoChange,
}: Props) {
  const [liquidacion, setLiquidacion] = useState<LiquidacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [localTarifa, setLocalTarifa] = useState<number | null>(tarifaHora);

  useEffect(() => {
    fetch(`/api/liquidaciones/${liquidacionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar');
        return r.json() as Promise<LiquidacionData>;
      })
      .then(setLiquidacion)
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [liquidacionId]);

  const handleDiaUpdate = useCallback((updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => {
    setLiquidacion((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dias: prev.dias.map((d) => d.id === updatedDia.id ? updatedDia : d),
        horasOrdinarias: updatedTotales.horasOrdinarias,
        horasExtra: updatedTotales.horasExtra,
        valorHorasOrdinarias: updatedTotales.valorHorasOrdinarias,
        valorHorasExtra: updatedTotales.valorHorasExtra,
        totalBonos: updatedTotales.totalBonos,
        totalDescuentos: updatedTotales.totalDescuentos,
        totalPago: updatedTotales.totalPago,
        calculadoEn: updatedTotales.calculadoEn,
      };
    });
  }, []);

  const handleConfirmed = useCallback(() => {
    setLiquidacion((prev) => prev ? { ...prev, estado: 'APROBADO' } : prev);
    onEstadoChange(liquidacionId, 'APROBADO');
  }, [liquidacionId, onEstadoChange]);

  const isLocked = liquidacion?.estado === 'APROBADO';
  const hasInconsistencias = liquidacion?.dias.some((d) => d.tieneInconsistencia) ?? false;

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: isLocked ? 'success.light' : 'divider',
        opacity: isLocked ? 0.85 : 1,
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: isLocked ? 'success.50' : 'background.default',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {/* Left: name + estado */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {apellido}, {nombre}
          </Typography>
          {liquidacion && (
            liquidacion.estado === 'APROBADO'
              ? <Chip label="Aprobado" size="small" color="success" />
              : <Chip label="Borrador" size="small" color="warning" variant="outlined" />
          )}
        </Box>

        {/* Right: tarifa | horas | total | confirmar */}
        {liquidacion && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <TarifaEditor
              colaboradorId={colaboradorId}
              value={localTarifa}
              onChange={setLocalTarifa}
            />
            <Typography variant="body2" color="text.secondary">
              {liquidacion.horasOrdinarias.toFixed(2)} h
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }} color="success.dark">
              {liquidacion.totalPago.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
            </Typography>
            <ConfirmarColaboradorButton
              liquidacionId={liquidacionId}
              hasInconsistencias={hasInconsistencias}
              isConfirmed={isLocked}
              onConfirmed={handleConfirmed}
            />
          </Box>
        )}
      </Box>

      <Divider />

      {/* ── Loading / error ── */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Cargando…</Typography>
        </Box>
      )}
      {fetchError && (
        <Typography color="error" variant="body2" sx={{ px: 2, py: 1 }}>{fetchError}</Typography>
      )}

      {/* ── Days table ── */}
      {liquidacion && liquidacion.dias.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600, width: 90 }}>Fecha</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Marcaciones</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 120 }}>Horas</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 130 }}>Estado</TableCell>
              <TableCell sx={{ width: 40 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {liquidacion.dias.map((dia) => (
              <PlanillaDiaRow
                key={dia.id}
                dia={dia}
                isReadOnly={isLocked}
                onDiaUpdate={handleDiaUpdate}
              />
            ))}
          </TableBody>
        </Table>
      )}
      {liquidacion && liquidacion.dias.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          Sin días registrados.
        </Typography>
      )}
    </Paper>
  );
}
