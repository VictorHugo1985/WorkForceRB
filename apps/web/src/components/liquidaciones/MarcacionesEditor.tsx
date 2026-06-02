'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import UndoIcon from '@mui/icons-material/Undo';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';

interface Jornada {
  entrada: string;
  salida: string;
}

interface Props {
  dia: DiaLiquidacionData;
  isReadOnly: boolean;
  onSaved: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function shiftHours(entrada: string, salida: string): number {
  if (!TIME_RE.test(entrada) || !TIME_RE.test(salida)) return 0;
  const diff = timeToMinutes(salida) - timeToMinutes(entrada);
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
}

function totalHoras(jornadas: Jornada[]): number {
  return Math.round(jornadas.reduce((s, j) => s + shiftHours(j.entrada, j.salida), 0) * 100) / 100;
}

function initJornadas(dia: DiaLiquidacionData): Jornada[] {
  // Manual overrides take precedence
  if (dia.marcacionesManuales && dia.marcacionesManuales.length > 0) {
    return dia.marcacionesManuales.map((j) => ({ entrada: j.entrada, salida: j.salida }));
  }
  // Fall back to biometric jornadas
  const base = (dia.jornadas ?? []).map((j) => ({ entrada: j.entrada, salida: j.salida }));
  // Include unpaired punch as a partial row so supervisor can complete it
  if (dia.marcacionSuelta) {
    base.push({ entrada: dia.marcacionSuelta, salida: '' });
  }
  return base.length > 0 ? base : [{ entrada: '', salida: '' }];
}

export function MarcacionesEditor({ dia, isReadOnly, onSaved }: Props) {
  const [jornadas, setJornadas] = useState<Jornada[]>(() => initJornadas(dia));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((i: number, field: 'entrada' | 'salida', value: string) => {
    setJornadas((prev) => prev.map((j, idx) => idx === i ? { ...j, [field]: value } : j));
    setDirty(true);
    setError(null);
  }, []);

  const addJornada = useCallback(() => {
    setJornadas((prev) => [...prev, { entrada: '', salida: '' }]);
    setDirty(true);
  }, []);

  const removeJornada = useCallback((i: number) => {
    setJornadas((prev) => prev.length === 1 ? [{ entrada: '', salida: '' }] : prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }, []);

  const revert = useCallback(() => {
    setJornadas(initJornadas(dia));
    setDirty(false);
    setError(null);
  }, [dia]);

  const save = useCallback(async () => {
    // Filter complete pairs; empty row means "clear"
    const complete = jornadas.filter((j) => j.entrada && j.salida);
    const payload = complete.length > 0 ? complete : null;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dias-liquidacion/${dia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marcacionesManuales: payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setError(err.message ?? `Error ${res.status}`);
        return;
      }
      const data = await res.json() as { dia: DiaLiquidacionData; totales: TotalesData };
      setDirty(false);
      onSaved(data.dia, data.totales);
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }, [dia.id, jornadas, onSaved]);

  const computed = totalHoras(jornadas);
  const hasIncompleteRow = jornadas.some((j) => (j.entrada && !j.salida) || (!j.entrada && j.salida));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {jornadas.map((j, i) => {
        const h = shiftHours(j.entrada, j.salida);
        const salidaIncompleta = j.entrada !== '' && j.salida === '';
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TextField
              size="small"
              type="time"
              value={j.entrada}
              onChange={(e) => update(i, 'entrada', e.target.value)}
              disabled={isReadOnly || saving}
              sx={{ width: 108 }}
              slotProps={{
                htmlInput: { step: 60, style: { fontSize: '0.8rem', padding: '4px 6px' } },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ userSelect: 'none' }}>→</Typography>
            <Tooltip title={salidaIncompleta ? 'Salida pendiente' : ''} placement="top">
              <TextField
                size="small"
                type="time"
                value={j.salida}
                onChange={(e) => update(i, 'salida', e.target.value)}
                disabled={isReadOnly || saving}
                sx={{
                  width: 108,
                  ...(salidaIncompleta && {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'warning.main',
                      borderWidth: 2,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'warning.dark',
                    },
                  }),
                }}
                slotProps={{
                  htmlInput: { step: 60, style: { fontSize: '0.8rem', padding: '4px 6px' } },
                }}
              />
            </Tooltip>
            {h > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
                {h.toFixed(1)}h
              </Typography>
            )}
            {!isReadOnly && (
              <Tooltip title="Quitar turno">
                <IconButton size="small" onClick={() => removeJornada(i)} disabled={saving} sx={{ p: 0.25 }}>
                  <RemoveCircleIcon sx={{ fontSize: 16 }} color="disabled" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      })}

      {/* Controls row */}
      {!isReadOnly && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
          <Tooltip title="Agregar turno">
            <IconButton size="small" onClick={addJornada} disabled={saving} sx={{ p: 0.25 }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {computed > 0 && (
            <Typography variant="caption" color="text.secondary">
              {computed.toFixed(2)} h
            </Typography>
          )}

          {dirty && (
            <>
              <Tooltip title="Guardar marcaciones">
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={save}
                    disabled={saving || hasIncompleteRow}
                    sx={{ p: 0.25 }}
                  >
                    {saving ? <CircularProgress size={14} /> : <CheckIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Descartar cambios">
                <IconButton size="small" onClick={revert} disabled={saving} sx={{ p: 0.25 }}>
                  <UndoIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}

          {error && (
            <Typography variant="caption" color="error">{error}</Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
