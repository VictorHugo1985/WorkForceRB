'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PunchItem { id: number; time: string }

let _nextId = 0;
const mkItem = (time = ''): PunchItem => ({ id: _nextId++, time });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initItems(dia: DiaLiquidacionData): PunchItem[] {
  let flat: string[];
  if (dia.marcacionesManuales && dia.marcacionesManuales.length > 0) {
    flat = dia.marcacionesManuales.flatMap((j) => [j.entrada, j.salida]);
  } else {
    flat = (dia.jornadas ?? []).flatMap((j) => [j.entrada, j.salida]);
    if (dia.marcacionSuelta) flat.push(dia.marcacionSuelta);
  }
  const items = flat.filter(Boolean).map((t) => mkItem(t));
  return items.length > 0 ? items : [mkItem()];
}

// Orphan times are persisted as {entrada, salida:''} so they survive a save
// and are visible when the component re-mounts. The server skips incomplete
// pairs in the hours calculation.
function toPairs(items: PunchItem[]): Array<{ entrada: string; salida: string }> | null {
  const filled = items.map((i) => i.time).filter(Boolean);
  if (filled.length === 0) return null;
  const pairs: Array<{ entrada: string; salida: string }> = [];
  for (let i = 0; i < filled.length; i += 2) {
    pairs.push({ entrada: filled[i], salida: filled[i + 1] ?? '' });
  }
  return pairs;
}

// ─── Sortable punch chip ──────────────────────────────────────────────────────

interface ChipProps {
  item: PunchItem;
  index: number;
  isReadOnly: boolean;
  saving: boolean;
  onUpdate: (id: number, value: string) => void;
  onRemove: (id: number) => void;
  onBlur: () => void;
  onFocus: () => void;
}

function SortablePunch({ item, index, isReadOnly, saving, onUpdate, onRemove, onBlur, onFocus }: ChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const isEntrada = index % 2 === 0;

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.25, zIndex: isDragging ? 999 : undefined }}
    >
      {/* E/S label doubles as drag handle */}
      <Typography
        variant="caption"
        {...(!isReadOnly ? { ...attributes, ...listeners } : {})}
        sx={{
          color: isEntrada ? 'success.main' : 'error.main',
          fontWeight: 700,
          fontSize: '0.6rem',
          lineHeight: 1,
          userSelect: 'none',
          cursor: isReadOnly ? 'default' : 'grab',
          '&:active': { cursor: 'grabbing' },
          px: 0.25,
        }}
      >
        {isEntrada ? 'E' : 'S'}
      </Typography>

      <TextField
        size="small"
        type="time"
        value={item.time}
        onChange={(e) => onUpdate(item.id, e.target.value)}
        onBlur={isReadOnly ? undefined : onBlur}
        onFocus={isReadOnly ? undefined : onFocus}
        disabled={isReadOnly || saving}
        sx={{
          width: 84,
          ...(!isReadOnly && !item.time ? {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'error.main', borderWidth: 2 },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'error.dark', borderWidth: 2 },
          } : {}),
        }}
        slotProps={{ htmlInput: { step: 60, lang: 'es', style: { fontSize: '0.75rem', padding: '2px 4px' } } }}
      />

      {!isReadOnly && (
        <Tooltip title="Quitar marcación">
          <IconButton size="small" onClick={() => onRemove(item.id)} disabled={saving} sx={{ p: 0.1 }}>
            <CloseIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Main editor ─────────────────────────────────────────────────────────────

interface Props {
  dia: DiaLiquidacionData;
  isReadOnly: boolean;
  onSaved: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}

export function MarcacionesEditor({ dia, isReadOnly, onSaved }: Props) {
  const [items, setItems] = useState<PunchItem[]>(() => initItems(dia));
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const itemsRef     = useRef(items);
  const dirtyRef     = useRef(false);
  const savingRef    = useRef(saving);
  const editCountRef = useRef(0);
  const blurTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  itemsRef.current  = items;
  dirtyRef.current  = dirty;
  savingRef.current = saving;

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  // Re-initialize when dia content changes from outside (e.g. reiniciar clears marcacionesManuales)
  const manualesKey = JSON.stringify(dia.marcacionesManuales ?? null);
  useEffect(() => {
    if (savingRef.current) return;
    setItems(initItems(dia));
    setDirty(false);
    setError(null);
    editCountRef.current = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia.id, manualesKey]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Mutations ────────────────────────────────────────────────────────────

  const update = useCallback((id: number, value: string) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, time: value } : it));
    editCountRef.current += 1;
    setDirty(true);
    setError(null);
  }, []);

  const remove = useCallback((id: number) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      return next.length > 0 ? next : [mkItem()];
    });
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const add = useCallback(() => {
    setItems((prev) => [...prev, mkItem()]);
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const insertAfter = useCallback((index: number) => {
    setItems((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, mkItem());
      return next;
    });
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  const revert = useCallback(() => {
    setItems(initItems(dia));
    setDirty(false);
    setError(null);
  }, [dia]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((it) => it.id === active.id);
      const to   = prev.findIndex((it) => it.id === over.id);
      return arrayMove(prev, from, to);
    });
    editCountRef.current += 1;
    setDirty(true);
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    const countAtSave = editCountRef.current;
    const payload = toPairs(itemsRef.current);
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
      if (editCountRef.current === countAtSave) {
        setDirty(false);
        setItems(initItems(data.dia));
      }
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
      if (itemsRef.current.some((it) => it.time)) saveRef.current();
    }, 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimer.current !== null) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.25 }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={horizontalListSortingStrategy}>
          {items.map((item, i) => (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center' }}>
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
              <SortablePunch
                item={item}
                index={i}
                isReadOnly={isReadOnly}
                saving={saving}
                onUpdate={update}
                onRemove={remove}
                onBlur={handleBlur}
                onFocus={handleFocus}
              />
            </Box>
          ))}
        </SortableContext>
      </DndContext>

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
