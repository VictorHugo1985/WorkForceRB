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
import CloseIcon from '@mui/icons-material/Close';
import UndoIcon from '@mui/icons-material/Undo';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';

interface Props {
  dia: DiaLiquidacionData;
  isReadOnly: boolean;
  onSaved: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}

// Flatten biometric jornadas or manual pairs to a simple ordered list of HH:MM times
function initFlat(dia: DiaLiquidacionData): string[] {
  if (dia.marcacionesManuales && dia.marcacionesManuales.length > 0) {
    return dia.marcacionesManuales.flatMap((j) => [j.entrada, j.salida]);
  }
  const flat: string[] = (dia.jornadas ?? []).flatMap((j) => [j.entrada, j.salida]);
  if (dia.marcacionSuelta) flat.push(dia.marcacionSuelta);
  return flat.length > 0 ? flat : [''];
}

// Group flat times into entrada/salida pairs for the API
function flatToPairs(times: string[]): Array<{ entrada: string; salida: string }> | null {
  const filled = times.filter(Boolean);
  if (filled.length === 0) return null;
  const pairs: Array<{ entrada: string; salida: string }> = [];
  for (let i = 0; i + 1 < filled.length; i += 2) {
    pairs.push({ entrada: filled[i], salida: filled[i + 1] });
  }
  return pairs.length > 0 ? pairs : null;
}

export function MarcacionesEditor({ dia, isReadOnly, onSaved }: Props) {
  const [times, setTimes] = useState<string[]>(() => initFlat(dia));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timesRef    = useRef(times);
  const dirtyRef    = useRef(false);
  const savingRef   = useRef(saving);
  const editCountRef = useRef(0);
  const blurTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  timesRef.current  = times;
  dirtyRef.current  = dirty;
  savingRef.current = saving;

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  const update = useCallback((i: number, value: string) => {
    setTimes((prev) => prev.map((t, idx) => idx === i ? value : t));
    editCountRef.current += 1;
    setDirty(true);
    setError(null);
  }, []);

  const remove = useCallback((i: number) => {
    setTimes((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length > 0 ? next : [''];
    });
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const add = useCallback(() => {
    setTimes((prev) => [...prev, '']);
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const insertAfter = useCallback((i: number) => {
    setTimes((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, '');
      return next;
    });
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const revert = useCallback(() => {
    setTimes(initFlat(dia));
    setDirty(false);
    setError(null);
  }, [dia]);

  const save = useCallback(async () => {
    const countAtSave = editCountRef.current;
    const payload = flatToPairs(timesRef.current);
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
      if (editCountRef.current === countAtSave) setDirty(false);
      onSaved(data.dia, data.totales);
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }, [dia.id, onSaved]);

  const saveRef = useRef(save);
  saveRef.current = save;

  const handleBlur = useCallback(() => {
    blurTimer.current = setTimeout(() => {
      if (!dirtyRef.current || savingRef.current) return;
      const hasPair = timesRef.current.filter(Boolean).length >= 2;
      if (hasPair) saveRef.current();
    }, 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimer.current !== null) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25 }}>
      {times.map((t, i) => {
        const isEntrada = i % 2 === 0;
        return (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {/* Insert-before button between marcaciones */}
            {!isReadOnly && i > 0 && (
              <Tooltip title="Insertar marcación aquí">
                <IconButton
                  size="small"
                  onClick={() => insertAfter(i - 1)}
                  disabled={saving}
                  sx={{ p: 0.1, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                >
                  <AddIcon sx={{ fontSize: 11 }} />
                </IconButton>
              </Tooltip>
            )}
            <Typography
              variant="caption"
              sx={{
                color: isEntrada ? 'success.main' : 'error.main',
                fontWeight: 700,
                fontSize: '0.6rem',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              {isEntrada ? 'E' : 'S'}
            </Typography>
            <TextField
              size="small"
              type="time"
              value={t}
              onChange={(e) => update(i, e.target.value)}
              onBlur={isReadOnly ? undefined : handleBlur}
              onFocus={isReadOnly ? undefined : handleFocus}
              disabled={isReadOnly || saving}
              sx={{
                width: 84,
                ...(!isReadOnly && !t ? {
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main', borderWidth: 2 },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'error.dark', borderWidth: 2 },
                } : {}),
              }}
              slotProps={{ htmlInput: { step: 60, style: { fontSize: '0.75rem', padding: '2px 4px' } } }}
            />
            {!isReadOnly && (
              <Tooltip title="Quitar marcación">
                <IconButton size="small" onClick={() => remove(i)} disabled={saving} sx={{ p: 0.1 }}>
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        );
      })}

      {!isReadOnly && (
        <Tooltip title="Agregar marcación al final">
          <IconButton size="small" onClick={add} disabled={saving} sx={{ p: 0.2, ml: 0.25 }}>
            <AddIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}

      {!isReadOnly && dirty && (
        <>
          <Tooltip title="Guardar">
            <span>
              <IconButton size="small" color="primary" onClick={save} disabled={saving} sx={{ p: 0.25 }}>
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
        <Typography variant="caption" color="error" sx={{ width: '100%' }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
