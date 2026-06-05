'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
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
    base.push({ entrada: dia.marcacionSuelta, salida: '' });
  }
  return base.length > 0 ? base : [{ entrada: '', salida: '' }];
}

function emptyBorder(empty: boolean) {
  if (!empty) return {};
  return {
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main', borderWidth: 2 },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'error.dark', borderWidth: 2 },
  };
}

export function MarcacionesEditor({ dia, isReadOnly, onSaved }: Props) {
  const [jornadas, setJornadas] = useState<Jornada[]>(() => initJornadas(dia));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs so blur-timer callbacks always see the latest values without stale closures
  const saveRef      = useRef<() => Promise<void>>(async () => {});
  const jornadasRef  = useRef(jornadas);
  const dirtyRef     = useRef(false);
  const savingRef    = useRef(false);
  const blurTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track edit count so an in-flight save's setDirty(false) doesn't clobber a new edit
  const editCountRef = useRef(0);

  jornadasRef.current  = jornadas;
  dirtyRef.current     = dirty;
  savingRef.current    = saving;

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  const update = useCallback((i: number, field: 'entrada' | 'salida', value: string) => {
    setJornadas((prev) => prev.map((j, idx) => idx === i ? { ...j, [field]: value } : j));
    editCountRef.current += 1;
    setDirty(true);
    setError(null);
  }, []);

  const swap = useCallback((i: number) => {
    setJornadas((prev) => prev.map((j, idx) => idx === i ? { entrada: j.salida, salida: j.entrada } : j));
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const add = useCallback(() => {
    setJornadas((prev) => [...prev, { entrada: '', salida: '' }]);
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const remove = useCallback((i: number) => {
    setJornadas((prev) => prev.length === 1 ? [{ entrada: '', salida: '' }] : prev.filter((_, idx) => idx !== i));
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const revert = useCallback(() => {
    setJornadas(initJornadas(dia));
    setDirty(false);
    setError(null);
  }, [dia]);

  const save = useCallback(async () => {
    const countAtSave = editCountRef.current;
    const complete = jornadasRef.current.filter((j) => j.entrada && j.salida);
    const payload = complete.length > 0 ? complete : null;
    console.log('[MarcacionesEditor] save fired — dia.id:', dia.id, 'jornadasRef:', JSON.stringify(jornadasRef.current), 'payload:', JSON.stringify(payload));
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
        console.error('[MarcacionesEditor] save error:', res.status, err);
        setError(err.message ?? `Error ${res.status}`);
        return;
      }
      const data = await res.json() as { dia: DiaLiquidacionData; totales: TotalesData };
      console.log('[MarcacionesEditor] save response — horasAjustadas:', data.dia.horasAjustadasSupervisor, 'horasOrdinarias:', data.totales.horasOrdinarias);
      // Only mark clean if no new edits happened during the async fetch
      if (editCountRef.current === countAtSave) {
        setDirty(false);
      }
      onSaved(data.dia, data.totales);
    } catch (e) {
      console.error('[MarcacionesEditor] save exception:', e);
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }, [dia.id, onSaved]);

  saveRef.current = save;

  // Auto-save on blur.
  // Guard: only fire if there is at least one complete entrada+salida pair — avoids
  // saving null when the user is still in the middle of filling the second field.
  const handleBlur = useCallback(() => {
    blurTimer.current = setTimeout(() => {
      if (!dirtyRef.current || savingRef.current) return;
      const hasComplete = jornadasRef.current.some((j) => j.entrada && j.salida);
      if (hasComplete) saveRef.current();
    }, 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimer.current !== null) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {jornadas.map((j, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            size="small"
            type="time"
            value={j.entrada}
            onChange={(e) => update(i, 'entrada', e.target.value)}
            onBlur={isReadOnly ? undefined : handleBlur}
            onFocus={isReadOnly ? undefined : handleFocus}
            disabled={isReadOnly || saving}
            sx={{ width: 108, ...emptyBorder(!isReadOnly && !j.entrada) }}
            slotProps={{ htmlInput: { step: 60, style: { fontSize: '0.8rem', padding: '4px 6px' } } }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ userSelect: 'none' }}>→</Typography>
          <TextField
            size="small"
            type="time"
            value={j.salida}
            onChange={(e) => update(i, 'salida', e.target.value)}
            onBlur={isReadOnly ? undefined : handleBlur}
            onFocus={isReadOnly ? undefined : handleFocus}
            disabled={isReadOnly || saving}
            sx={{ width: 108, ...emptyBorder(!isReadOnly && !j.salida) }}
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
