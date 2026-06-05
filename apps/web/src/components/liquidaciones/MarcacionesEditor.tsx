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
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
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

function initJornadas(dia: DiaLiquidacionData): Jornada[] {
  if (dia.marcacionesManuales && dia.marcacionesManuales.length > 0) {
    return dia.marcacionesManuales.map((j) => ({ entrada: j.entrada, salida: j.salida }));
  }
  const base: Jornada[] = (dia.jornadas ?? []).map((j) => ({ entrada: j.entrada, salida: j.salida }));
  if (dia.marcacionSuelta) {
    // Orphan punch: positionally it's the first of its incomplete pair.
    // Oldest available → entrada slot; missing partner → salida slot empty.
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

  const swap = useCallback((i: number) => {
    setJornadas((prev) => prev.map((j, idx) => idx === i ? { entrada: j.salida, salida: j.entrada } : j));
    setDirty(true);
  }, []);

  const add = useCallback(() => {
    setJornadas((prev) => [...prev, { entrada: '', salida: '' }]);
    setDirty(true);
  }, []);

  const remove = useCallback((i: number) => {
    setJornadas((prev) => prev.length === 1 ? [{ entrada: '', salida: '' }] : prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }, []);

  const revert = useCallback(() => {
    setJornadas(initJornadas(dia));
    setDirty(false);
    setError(null);
  }, [dia]);

  const save = useCallback(async () => {
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {jornadas.map((j, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            size="small"
            type="time"
            value={j.entrada}
            onChange={(e) => update(i, 'entrada', e.target.value)}
            disabled={isReadOnly || saving}
            sx={{ width: 108 }}
            slotProps={{ htmlInput: { step: 60, style: { fontSize: '0.8rem', padding: '4px 6px' } } }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ userSelect: 'none' }}>→</Typography>
          <TextField
            size="small"
            type="time"
            value={j.salida}
            onChange={(e) => update(i, 'salida', e.target.value)}
            disabled={isReadOnly || saving}
            sx={{ width: 108 }}
            slotProps={{ htmlInput: { step: 60, style: { fontSize: '0.8rem', padding: '4px 6px' } } }}
          />
          {!isReadOnly && (
            <>
              <Tooltip title="Intercambiar">
                <IconButton size="small" onClick={() => swap(i)} disabled={saving} sx={{ p: 0.25 }}>
                  <SwapHorizIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Quitar">
                <IconButton size="small" onClick={() => remove(i)} disabled={saving} sx={{ p: 0.25 }}>
                  <RemoveCircleIcon sx={{ fontSize: 16 }} color="disabled" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Agregar turno">
                <IconButton size="small" onClick={add} disabled={saving} sx={{ p: 0.25 }}>
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      ))}

      {!isReadOnly && dirty && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
          <Tooltip title="Guardar">
            <span>
              <IconButton size="small" color="primary" onClick={save} disabled={saving} sx={{ p: 0.25 }}>
                {saving ? <CircularProgress size={14} /> : <CheckIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Descartar">
            <IconButton size="small" onClick={revert} disabled={saving} sx={{ p: 0.25 }}>
              <UndoIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {error && <Typography variant="caption" color="error">{error}</Typography>}
        </Box>
      )}
    </Box>
  );
}
