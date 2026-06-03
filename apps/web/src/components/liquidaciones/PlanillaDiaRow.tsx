'use client';

import { useState, useCallback, useEffect } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import UndoIcon from '@mui/icons-material/Undo';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';
import { MarcacionesEditor } from './MarcacionesEditor';

interface Props {
  dia: DiaLiquidacionData;
  isReadOnly: boolean;
  tarifaHora: number | null;
  onDiaUpdate: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}

const DIAS_CORTO: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
};

const TIPOS = [
  { value: 'BONO_HORAS_EXTRAS', label: 'Bono Horas Extras' },
  { value: 'BONO_TRANSPORTE',   label: 'Bono Transporte' },
  { value: 'ESTIPENDIO',        label: 'Estipendio' },
  { value: 'DESCUENTO',         label: 'Descuento' },
] as const;

type TipoAjuste = typeof TIPOS[number]['value'] | '';

function formatFecha(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${DIAS_CORTO[d.getUTCDay()]} ${dd}/${mm}`;
}

function estadoChip(estado: string) {
  switch (estado) {
    case 'APROBADO':               return <Chip label="Aprobado" size="small" color="success" />;
    case 'CON_AJUSTE_HORAS':       return <Chip label="H. ajust." size="small" color="info" />;
    case 'CON_DESCUENTO':          return <Chip label="Con ajuste" size="small" color="warning" />;
    case 'CON_AJUSTE_Y_DESCUENTO': return <Chip label="H. + ajuste" size="small" color="warning" />;
    default:                       return <Chip label="Sin rev." size="small" variant="outlined" />;
  }
}

function tipoLabel(tipo: string | null) {
  return TIPOS.find((t) => t.value === tipo)?.label ?? null;
}

function effectiveHoras(dia: DiaLiquidacionData): number {
  return dia.horasAjustadasSupervisor ?? dia.horasParejadas ?? dia.horasCalculadas;
}

export function PlanillaDiaRow({ dia, isReadOnly, onDiaUpdate }: Props) {
  const cellReadOnly = isReadOnly || dia.estadoDia === 'APROBADO';

  // ── Horas inline edit ──────────────────────────────────────────────
  const [horas, setHoras] = useState<string>(String(effectiveHoras(dia)));
  const [horasDirty, setHorasDirty] = useState(false);
  const [horasSaving, setHorasSaving] = useState(false);
  const [horasError, setHorasError] = useState<string | null>(null);

  // Sync when dia updates externally (e.g. marcaciones edit re-calculates hours)
  useEffect(() => {
    if (!horasDirty) setHoras(String(effectiveHoras(dia)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia.horasAjustadasSupervisor, dia.horasParejadas, dia.horasCalculadas]);

  const handleHorasChange = (value: string) => {
    setHoras(value);
    setHorasDirty(true);
    setHorasError(null);
  };

  const revertHoras = useCallback(() => {
    setHoras(String(effectiveHoras(dia)));
    setHorasDirty(false);
    setHorasError(null);
  }, [dia]);

  const saveHoras = useCallback(async () => {
    const horasNum = parseFloat(horas);
    if (isNaN(horasNum) || horasNum < 0) { setHorasError('Valor inválido'); return; }
    setHorasSaving(true);
    setHorasError(null);
    try {
      const res = await fetch(`/api/dias-liquidacion/${dia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horasAjustadasSupervisor: horasNum }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setHorasError(err.message ?? `Error ${res.status}`);
        return;
      }
      const data = await res.json() as { dia: DiaLiquidacionData; totales: TotalesData };
      setHorasDirty(false);
      onDiaUpdate(data.dia, data.totales);
    } catch {
      setHorasError('Error de conexión');
    } finally {
      setHorasSaving(false);
    }
  }, [dia.id, horas, onDiaUpdate]);

  // ── Ajuste tipo / monto inline edit ────────────────────────────────
  const [tipo, setTipo] = useState<TipoAjuste>((dia.ajusteTipo as TipoAjuste) ?? '');
  const [monto, setMonto] = useState<string>(dia.ajusteValor != null ? String(dia.ajusteValor) : '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTipoChange = (value: TipoAjuste) => {
    setTipo(value);
    if (!value) setMonto('');
    setDirty(true);
    setError(null);
  };

  const handleMontoChange = (value: string) => {
    setMonto(value);
    setDirty(true);
    setError(null);
  };

  const revert = useCallback(() => {
    setTipo((dia.ajusteTipo as TipoAjuste) ?? '');
    setMonto(dia.ajusteValor != null ? String(dia.ajusteValor) : '');
    setDirty(false);
    setError(null);
  }, [dia]);

  const save = useCallback(async () => {
    const montoNum = monto ? Number(monto) : null;
    if (tipo && (montoNum === null || isNaN(montoNum) || montoNum <= 0)) {
      setError('Ingrese un monto válido');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = tipo
        ? { ajusteTipo: tipo, ajusteValor: montoNum }
        : { ajusteTipo: null };
      const res = await fetch(`/api/dias-liquidacion/${dia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setError(err.message ?? `Error ${res.status}`);
        return;
      }
      const data = await res.json() as { dia: DiaLiquidacionData; totales: TotalesData };
      setDirty(false);
      onDiaUpdate(data.dia, data.totales);
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  }, [dia.id, tipo, monto, onDiaUpdate]);

  const isAjustado = dia.horasAjustadasSupervisor != null;
  const horasOrig  = (dia.horasParejadas ?? dia.horasCalculadas);

  return (
    <TableRow>
      {/* Fecha */}
      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500, verticalAlign: 'middle' }}>
        {formatFecha(dia.fecha)}
      </TableCell>

      {/* Marcaciones */}
      <TableCell sx={{ verticalAlign: 'top', pt: 1 }}>
        <MarcacionesEditor dia={dia} isReadOnly={cellReadOnly} onSaved={onDiaUpdate} />
      </TableCell>

      {/* Horas */}
      <TableCell sx={{ verticalAlign: 'middle' }}>
        {cellReadOnly ? (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {effectiveHoras(dia).toFixed(2)} h
            </Typography>
            {isAjustado && (
              <Typography variant="caption" color="text.secondary">
                orig: {horasOrig.toFixed(2)}
              </Typography>
            )}
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TextField
                size="small"
                type="number"
                value={horas}
                onChange={(e) => handleHorasChange(e.target.value)}
                disabled={horasSaving}
                error={!!horasError}
                sx={{ width: 82, '& .MuiInputBase-input': { fontSize: '0.8rem', py: '5px' } }}
                slotProps={{ htmlInput: { min: 0, step: 0.25 } }}
              />
              {horasDirty && (
                <>
                  <Tooltip title="Confirmar">
                    <span>
                      <IconButton size="small" color="primary" onClick={saveHoras} disabled={horasSaving} sx={{ p: 0.25 }}>
                        {horasSaving ? <CircularProgress size={14} /> : <CheckIcon sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Descartar">
                    <IconButton size="small" onClick={revertHoras} disabled={horasSaving} sx={{ p: 0.25 }}>
                      <UndoIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
            {horasError && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.25 }}>
                {horasError}
              </Typography>
            )}
            {isAjustado && !horasDirty && (
              <Typography variant="caption" color="text.secondary">
                orig: {horasOrig.toFixed(2)}
              </Typography>
            )}
          </Box>
        )}
      </TableCell>

      {/* Tipo ajuste */}
      <TableCell sx={{ verticalAlign: 'middle' }}>
        {cellReadOnly ? (
          tipo ? (
            <Chip
              label={tipoLabel(tipo)}
              size="small"
              color={tipo === 'DESCUENTO' ? 'warning' : 'success'}
              variant="outlined"
            />
          ) : <Typography variant="body2" color="text.disabled">—</Typography>
        ) : (
          <Select
            size="small"
            value={tipo}
            onChange={(e) => handleTipoChange(e.target.value as TipoAjuste)}
            displayEmpty
            disabled={saving}
            sx={{ fontSize: '0.8rem', minWidth: 155 }}
          >
            <MenuItem value=""><em>Sin ajuste</em></MenuItem>
            {TIPOS.map((t) => (
              <MenuItem key={t.value} value={t.value} sx={{ fontSize: '0.8rem' }}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        )}
      </TableCell>

      {/* Monto Ajuste */}
      <TableCell sx={{ verticalAlign: 'middle' }}>
        {cellReadOnly ? (
          <Typography variant="body2" sx={{ fontWeight: monto ? 500 : undefined, color: monto ? (tipo === 'DESCUENTO' ? 'warning.main' : 'success.main') : 'text.disabled' }}>
            {monto ? `${tipo === 'DESCUENTO' ? '−' : '+'}${Number(monto).toFixed(2)} Bs.` : '—'}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TextField
              size="small"
              type="number"
              placeholder={tipo ? '0.00' : '—'}
              value={monto}
              onChange={(e) => handleMontoChange(e.target.value)}
              disabled={saving || !tipo}
              error={!!error}
              sx={{ width: 100, '& .MuiInputBase-input': { fontSize: '0.8rem', py: '5px' } }}
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
            />
            {dirty && (
              <>
                <Tooltip title="Guardar">
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={save}
                      disabled={saving || (!!tipo && (!monto || Number(monto) <= 0))}
                      sx={{ p: 0.25 }}
                    >
                      {saving ? <CircularProgress size={14} /> : <CheckIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Descartar">
                  <IconButton size="small" onClick={revert} disabled={saving} sx={{ p: 0.25 }}>
                    <UndoIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        )}
        {error && (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.25 }}>
            {error}
          </Typography>
        )}
      </TableCell>

      {/* Estado */}
      <TableCell sx={{ verticalAlign: 'middle' }}>
        {estadoChip(dia.estadoDia)}
      </TableCell>
    </TableRow>
  );
}
