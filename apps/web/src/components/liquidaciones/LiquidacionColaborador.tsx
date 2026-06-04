'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PaymentsIcon from '@mui/icons-material/Payments';
import VerifiedIcon from '@mui/icons-material/Verified';
import type { DiaLiquidacionData, LiquidacionData, TotalesData } from '@/stores/liquidacion.store';
import { PlanillaDiaRow } from './PlanillaDiaRow';

export type EstadoLiquidacion = 'BORRADOR' | 'APROBADO' | 'PAGADO';

interface Props {
  liquidacionId: string;
  colaboradorId: string;
  nombre: string;
  apellido: string;
  semanaId: string;
  tarifaHora: number | null;
  onEstadoChange: (liquidacionId: string, estado: EstadoLiquidacion) => void;
}


// ── Tarifa editor ─────────────────────────────────────────────────────────────

interface TarifaEditorProps {
  colaboradorId: string;
  value: number | null;
  readOnly: boolean;
  onChange: (v: number) => void;
}

function TarifaEditor({ colaboradorId, value, readOnly, onChange }: TarifaEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = () => { setDraft(value != null ? String(value) : ''); setError(null); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const cancel = () => { setEditing(false); setError(null); };

  const save = async () => {
    const num = parseFloat(draft);
    if (isNaN(num) || num <= 0) { setError('Valor inválido'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/colaboradores/${colaboradorId}/tarifa`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: num }),
      });
      if (res.status === 403) { setError('Sin permisos'); return; }
      if (!res.ok) { setError('Error'); return; }
      onChange(num); setEditing(false);
    } catch { setError('Error de red'); }
    finally { setSaving(false); }
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
          sx={{ width: 120 }}
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
        {value != null ? `${value.toFixed(2)} Bs./h` : '— Bs./h'}
      </Typography>
      {!readOnly && (
        <Tooltip title="Editar tarifa/hora">
          <IconButton size="small" onClick={start} sx={{ p: 0.25 }}>
            <EditIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: color ?? 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}

// ── Confirmar button (inline) ─────────────────────────────────────────────────

interface ConfirmarProps {
  liquidacionId: string;
  hasInconsistencias: boolean;
  onConfirmed: () => void;
}

function ConfirmarButton({ liquidacionId, hasInconsistencias, onConfirmed }: ConfirmarProps) {
  const [showWarn, setShowWarn] = useState(false);
  const [ack, setAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doConfirm = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/liquidaciones/${liquidacionId}/aprobar`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setError(err.message ?? 'Error al confirmar'); return;
      }
      onConfirmed();
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  };

  return (
    <Box>
      <Button
        variant="contained"
        size="small"
        onClick={() => hasInconsistencias ? setShowWarn(true) : doConfirm()}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <VerifiedIcon />}
        sx={{ whiteSpace: 'nowrap' }}
      >
        Confirmar
      </Button>
      {error && <Typography variant="caption" color="error" sx={{ ml: 1 }}>{error}</Typography>}
      {showWarn && (
        <Box sx={{ mt: 1, p: 1.5, bgcolor: 'warning.50', border: 1, borderColor: 'warning.light', borderRadius: 1, maxWidth: 380 }}>
          <Typography variant="caption" color="warning.dark" sx={{ display: 'block', mb: 1 }}>
            Hay días con marcaciones inconsistentes. ¿Confirmar de todas formas?
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={ack} onChange={(e) => setAck(e.target.checked)} size="small" />}
            label={<Typography variant="caption">Reconozco las inconsistencias</Typography>}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Button
              size="small"
              variant="contained"
              color="warning"
              disabled={!ack || loading}
              onClick={doConfirm}
              endIcon={loading ? <CircularProgress size={12} color="inherit" /> : undefined}
            >
              Confirmar
            </Button>
            <Button size="small" onClick={() => setShowWarn(false)}>Cancelar</Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Pagar button ──────────────────────────────────────────────────────────────

interface PagarProps {
  liquidacionId: string;
  onPagado: () => void;
}

function PagarButton({ liquidacionId, onPagado }: PagarProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const doPagar = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/liquidaciones/${liquidacionId}/pagar`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setError(err.message ?? 'Error'); return;
      }
      onPagado();
    } catch { setError('Error de conexión'); }
    finally { setLoading(false); }
  };

  if (!confirm) {
    return (
      <Button
        variant="outlined"
        size="small"
        color="secondary"
        onClick={() => setConfirm(true)}
        startIcon={<PaymentsIcon />}
        sx={{ whiteSpace: 'nowrap', borderColor: 'secondary.main', color: 'secondary.main' }}
      >
        Marcar como Pagado
      </Button>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" color="text.secondary">¿Confirmar pago?</Typography>
      <Button
        size="small"
        variant="contained"
        color="secondary"
        onClick={doPagar}
        disabled={loading}
        endIcon={loading ? <CircularProgress size={12} color="inherit" /> : undefined}
      >
        Sí, pagado
      </Button>
      <Button size="small" onClick={() => setConfirm(false)}>Cancelar</Button>
      {error && <Typography variant="caption" color="error">{error}</Typography>}
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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch(`/api/liquidaciones/${liquidacionId}`)
      .then((r) => { if (!r.ok) throw new Error('Error al cargar'); return r.json() as Promise<LiquidacionData>; })
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
      };
    });
  }, []);

  const handleConfirmed = useCallback(() => {
    setLiquidacion((prev) => prev ? { ...prev, estado: 'APROBADO' } : prev);
    onEstadoChange(liquidacionId, 'APROBADO');
  }, [liquidacionId, onEstadoChange]);

  const handlePagado = useCallback(() => {
    setLiquidacion((prev) => prev ? { ...prev, estado: 'PAGADO' } : prev);
    onEstadoChange(liquidacionId, 'PAGADO');
  }, [liquidacionId, onEstadoChange]);

  const estado = (liquidacion?.estado ?? null) as EstadoLiquidacion | null;
  const isAprobado = estado === 'APROBADO';
  const isPagado   = estado === 'PAGADO';
  const isLocked   = isAprobado || isPagado;
  const hasInconsistencias = liquidacion?.dias.some((d) => d.tieneInconsistencia) ?? false;

  const borderColorMap: Record<EstadoLiquidacion, string> = {
    BORRADOR: 'divider',
    APROBADO: 'success.main',
    PAGADO:   'secondary.main',
  };
  const borderColor = estado ? borderColorMap[estado] : 'divider';

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor,
        borderLeftWidth: 4,
        transition: 'border-color 0.2s',
      }}
    >
      {/* ── Header row 1: identity + status ── */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Tooltip title={collapsed ? 'Expandir' : 'Colapsar'}>
          <IconButton size="small" onClick={() => setCollapsed((v) => !v)} sx={{ p: 0.25 }}>
            <ExpandMoreIcon
              fontSize="small"
              sx={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.97rem', lineHeight: 1.2 }}>
            {apellido}, {nombre}
          </Typography>
          {estado === 'BORRADOR' && <Chip label="Borrador" size="small" color="default" variant="outlined" />}
          {estado === 'APROBADO' && <Chip label="✓ Aprobado" size="small" color="success" />}
          {estado === 'PAGADO'   && <Chip label="💰 Pagado" size="small" color="secondary" />}
        </Box>

        {/* Action zone */}
        {liquidacion && (
          <Box>
            {!isLocked && (
              <ConfirmarButton
                liquidacionId={liquidacionId}
                hasInconsistencias={hasInconsistencias}
                onConfirmed={handleConfirmed}
              />
            )}
            {isAprobado && (
              <PagarButton liquidacionId={liquidacionId} onPagado={handlePagado} />
            )}
          </Box>
        )}
      </Box>

      {/* ── Header row 2: stats (always visible) ── */}
      {loading && (
        <Box sx={{ px: 2, pb: 1.25, display: 'flex', gap: 2 }}>
          {[80, 60, 80, 80, 100].map((w, i) => (
            <Skeleton key={i} variant="rounded" width={w} height={32} />
          ))}
        </Box>
      )}
      {liquidacion && (
        <Box
          sx={{
            px: 2, pb: 1.25,
            display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap',
          }}
        >
          <TarifaEditor
            colaboradorId={colaboradorId}
            value={localTarifa}
            readOnly={isPagado}
            onChange={setLocalTarifa}
          />
          <Divider orientation="vertical" flexItem />
          <Stat label="Horas" value={`${liquidacion.horasOrdinarias.toFixed(2)} h`} />
          <Stat
            label="Bonos"
            value={`+${liquidacion.totalBonos.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`}
            color={liquidacion.totalBonos > 0 ? 'success.main' : 'text.secondary'}
          />
          <Stat
            label="Descuentos"
            value={`−${liquidacion.totalDescuentos.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`}
            color={liquidacion.totalDescuentos > 0 ? 'warning.main' : 'text.secondary'}
          />
          <Divider orientation="vertical" flexItem />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
              Total
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 700,
                color: isPagado ? 'secondary.main' : isAprobado ? 'success.dark' : 'primary.main',
              }}
            >
              {liquidacion.totalPago.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
            </Typography>
          </Box>
        </Box>
      )}

      {fetchError && (
        <Typography color="error" variant="body2" sx={{ px: 2, pb: 1.5 }}>{fetchError}</Typography>
      )}

      {/* ── Collapsible: days table ── */}
      <Collapse in={!collapsed} unmountOnExit={false}>
        <Divider />

        {loading && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rounded" height={40} />)}
          </Box>
        )}
        {liquidacion && liquidacion.dias.length > 0 && (
          <Table size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600, width: 90, color: 'text.secondary', fontSize: '0.75rem' }}>Fecha</TableCell>
                <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}>Marcaciones</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 100, color: 'text.secondary', fontSize: '0.75rem' }}>Horas</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 200, color: 'text.secondary', fontSize: '0.75rem' }}>Tipo ajuste</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 140, color: 'text.secondary', fontSize: '0.75rem' }}>Monto ajuste</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 110, color: 'text.secondary', fontSize: '0.75rem' }}>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {liquidacion.dias.map((dia) => (
                <PlanillaDiaRow
                  key={dia.id}
                  dia={dia}
                  isReadOnly={isLocked}
                  tarifaHora={localTarifa}
                  onDiaUpdate={handleDiaUpdate}
                />
              ))}
            </TableBody>
          </Table>
        )}
        {liquidacion && liquidacion.dias.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            Sin días registrados esta semana.
          </Typography>
        )}
      </Collapse>
    </Paper>
  );
}
