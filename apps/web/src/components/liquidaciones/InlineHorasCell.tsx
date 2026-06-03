'use client';

import { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';

interface Props {
  diaId: string;
  currentHoras: number;
  isReadOnly: boolean;
  onSaved: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}

export function InlineHorasCell({ diaId, currentHoras, isReadOnly, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftHoras, setDraftHoras] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const escPressed = useRef(false);

  const startEdit = () => {
    if (isReadOnly) return;
    setDraftHoras(String(currentHoras));
    setSaveError(null);
    escPressed.current = false;
    setEditing(true);
  };

  const cancelEdit = () => {
    escPressed.current = true;
    setEditing(false);
    setSaveError(null);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/dias-liquidacion/${diaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horasAjustadasSupervisor: parseFloat(draftHoras) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setSaveError(err.message ?? 'Error al guardar');
        return;
      }
      const data = await res.json() as { dia: DiaLiquidacionData; totales: TotalesData };
      onSaved(data.dia, data.totales);
      setEditing(false);
    } catch {
      setSaveError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  };

  if (!editing) {
    return (
      <Box
        onClick={startEdit}
        sx={{
          cursor: isReadOnly ? 'default' : 'pointer',
          px: 1,
          py: 0.5,
          borderRadius: 1,
          minWidth: 48,
          '&:hover': isReadOnly ? {} : { bgcolor: 'action.hover' },
        }}
      >
        {currentHoras.toFixed(2)}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <TextField
        autoFocus
        size="small"
        type="number"
        value={draftHoras}
        onChange={(e) => setDraftHoras(e.target.value)}
        onKeyDown={handleKeyDown}
        slotProps={{ htmlInput: { step: 0.25, min: 0, style: { width: 64 } } }}
        sx={{ width: 80 }}
        disabled={saving}
      />
      {saving && <CircularProgress size={16} />}
      {saveError && (
        <Typography variant="caption" color="error">{saveError}</Typography>
      )}
    </Box>
  );
}
