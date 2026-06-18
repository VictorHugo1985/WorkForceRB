'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SearchIcon from '@mui/icons-material/Search';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiaData {
  fecha: string;
  marcaciones: string[];
}

interface ColaboradorData {
  id: string;
  nombre: string;
  apellido: string;
  fijo: boolean;
  dias: DiaData[];
}

interface AreaData {
  areaId: string | null;
  areaNombre: string;
  colaboradores: ColaboradorData[];
}

interface DashboardData {
  fechaDesde: string;
  fechaHasta: string;
  areas: AreaData[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayBolivia(): string {
  const now = new Date();
  const offset = -4 * 60;
  const local = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  return local.toISOString().slice(0, 10);
}

function subtractDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfWeekBolivia(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function diasEnRango(fechaDesde: string, fechaHasta: string): number {
  const from = new Date(fechaDesde + 'T12:00:00Z');
  const to   = new Date(fechaHasta + 'T12:00:00Z');
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function presenceColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 0.8) return 'success';
  if (pct >= 0.4) return 'warning';
  return 'error';
}

const MUI_COLOR: Record<'success' | 'warning' | 'error', string> = {
  success: '#2e7d32',
  warning: '#ed6c02',
  error:   '#d32f2f',
};

// ─── Collaborator row ─────────────────────────────────────────────────────────

function ColaboradorRow({
  colab,
  isMultiDay,
  totalDias,
}: {
  colab: ColaboradorData;
  isMultiDay: boolean;
  totalDias: number;
}) {
  const asistio = colab.dias.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 0 },
        opacity: asistio ? 1 : 0.45,
      }}
    >
      {/* Status dot */}
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: asistio ? 'success.main' : 'text.disabled',
          flexShrink: 0,
        }}
      />

      {/* Name + tipo badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 160 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: asistio ? 500 : 400, fontSize: '0.82rem' }}
        >
          {colab.apellido}, {colab.nombre}
        </Typography>
        <Chip
          label={colab.fijo ? 'F' : 'J'}
          size="small"
          color={colab.fijo ? 'warning' : 'default'}
          variant={colab.fijo ? 'filled' : 'outlined'}
          sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, px: 0, '& .MuiChip-label': { px: '4px' } }}
        />
      </Box>

      {/* Attendance detail */}
      <Box sx={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end' }}>
        {!asistio ? (
          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            Sin registro
          </Typography>
        ) : isMultiDay ? (
          <Chip
            label={`${colab.dias.length} / ${totalDias} días`}
            size="small"
            color={presenceColor(colab.dias.length / totalDias)}
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        ) : (
          colab.dias[0]?.marcaciones.map((m, i) => (
            <Chip
              key={i}
              label={m}
              size="small"
              variant="outlined"
              color={i % 2 === 0 ? 'success' : 'error'}
              sx={{ height: 20, fontSize: '0.7rem', borderRadius: 1 }}
            />
          ))
        )}
      </Box>
    </Box>
  );
}

// ─── Area card ────────────────────────────────────────────────────────────────

function AreaCard({
  area,
  isMultiDay,
  totalDias,
  showAbsent,
}: {
  area: AreaData;
  isMultiDay: boolean;
  totalDias: number;
  showAbsent: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const presentes = area.colaboradores.filter((c) => c.dias.length > 0);
  const ausentes  = area.colaboradores.filter((c) => c.dias.length === 0);
  const total     = area.colaboradores.length;
  const pct       = total > 0 ? presentes.length / total : 0;
  const color     = presenceColor(pct);

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          px: 2,
          pt: 1.5,
          pb: 1,
          borderLeft: 4,
          borderColor: MUI_COLOR[color],
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, lineHeight: 1.2 }}>
            {area.areaNombre}
          </Typography>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, color: MUI_COLOR[color], lineHeight: 1 }}
          >
            {presentes.length}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1 }}>
            / {total}
          </Typography>
          <Tooltip title={expanded ? 'Colapsar' : 'Expandir'}>
            <IconButton size="small" sx={{ p: 0.25 }}>
              <ExpandMoreIcon
                fontSize="small"
                sx={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
              />
            </IconButton>
          </Tooltip>
        </Box>

        <LinearProgress
          variant="determinate"
          value={Math.round(pct * 100)}
          color={color}
          sx={{ height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {Math.round(pct * 100)}% de asistencia
        </Typography>
      </Box>

      {/* Body */}
      <Collapse in={expanded} unmountOnExit={false}>
        <Divider />
        {presentes.map((c) => (
          <ColaboradorRow key={c.id} colab={c} isMultiDay={isMultiDay} totalDias={totalDias} />
        ))}
        {showAbsent && ausentes.length > 0 && (
          <>
            {presentes.length > 0 && <Divider sx={{ borderStyle: 'dashed' }} />}
            {ausentes.map((c) => (
              <ColaboradorRow key={c.id} colab={c} isMultiDay={isMultiDay} totalDias={totalDias} />
            ))}
          </>
        )}
        {!showAbsent && ausentes.length > 0 && (
          <Box sx={{ px: 2, py: 0.75 }}>
            <Typography variant="caption" color="text.disabled">
              +{ausentes.length} ausente{ausentes.length > 1 ? 's' : ''} oculto{ausentes.length > 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type QuickFilter = 'hoy' | 'ayer' | 'semana' | 'custom';

export function DashboardClient() {
  const today = todayBolivia();

  const [fechaDesde, setFechaDesde]       = useState(today);
  const [fechaHasta, setFechaHasta]       = useState(today);
  const [colaborador, setColaborador]     = useState('');
  const [quick, setQuick]                 = useState<QuickFilter>('hoy');
  const [showAbsent, setShowAbsent]       = useState(true);

  // Committed filter state (triggers fetch)
  const [filter, setFilter] = useState({ fechaDesde: today, fechaHasta: today, colaborador: '' });

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Stable ref so doFetch always reads the latest filter without being a dep
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const applyFilter = useCallback(() => {
    setFilter({ fechaDesde, fechaHasta, colaborador });
  }, [fechaDesde, fechaHasta, colaborador]);

  const applyQuick = (q: QuickFilter) => {
    setQuick(q);
    const t = todayBolivia();
    if (q === 'hoy')    { setFechaDesde(t);                        setFechaHasta(t); }
    if (q === 'ayer')   { const y = subtractDays(t, 1); setFechaDesde(y); setFechaHasta(y); }
    if (q === 'semana') { setFechaDesde(startOfWeekBolivia(t));    setFechaHasta(t); }
  };

  // Shared fetch logic; silent=true for background 60s ticks (no loading spinner)
  const doFetch = useCallback((silent: boolean) => {
    const f = filterRef.current;
    const params = new URLSearchParams({ fecha_desde: f.fechaDesde, fecha_hasta: f.fechaHasta });
    if (f.colaborador) params.set('colaborador', f.colaborador);

    if (silent) { setRefreshing(true); }
    else        { setLoading(true); setError(null); }

    fetch(`/api/dashboard/asistencia?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() as Promise<DashboardData>; })
      .then(setData)
      .catch((e: Error) => { if (!silent) setError((e as Error).message); })
      .finally(() => { if (silent) setRefreshing(false); else setLoading(false); });
  // filterRef is a ref — intentionally omitted from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-apply when quick filter changes
  useEffect(() => {
    if (quick !== 'custom') {
      const t = todayBolivia();
      let desde = t, hasta = t;
      if (quick === 'ayer')   { desde = hasta = subtractDays(t, 1); }
      if (quick === 'semana') { desde = startOfWeekBolivia(t); }
      setFilter({ fechaDesde: desde, fechaHasta: hasta, colaborador });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick]);

  // Fetch on committed filter change (user-triggered — shows loading spinner)
  useEffect(() => {
    doFetch(false);
  }, [filter, doFetch]);

  // 60-second auto-refresh — only while viewing "Hoy" (Constitution Principle X)
  useEffect(() => {
    if (quick !== 'hoy') return;
    const id = setInterval(() => doFetch(true), 60_000);
    return () => clearInterval(id);
  }, [quick, doFetch]);

  const isMultiDay = filter.fechaDesde !== filter.fechaHasta;
  const totalDias  = isMultiDay ? diasEnRango(filter.fechaDesde, filter.fechaHasta) : 1;

  return (
    <Box>
      {/* Background-refresh pulse — thin bar, shown only during silent 60s ticks */}
      <LinearProgress
        variant="indeterminate"
        sx={{ height: 2, mb: 0.5, opacity: refreshing ? 1 : 0, transition: 'opacity 0.3s' }}
      />

      {/* ── Filters ── */}
      <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5 }}>
        {/* Quick filters + date range + search — all in one compact row */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['hoy', 'ayer', 'semana'] as const).map((q) => (
            <Chip
              key={q}
              label={q === 'hoy' ? 'Hoy' : q === 'ayer' ? 'Ayer' : 'Esta semana'}
              onClick={() => applyQuick(q)}
              color={quick === q ? 'primary' : 'default'}
              variant={quick === q ? 'filled' : 'outlined'}
              size="small"
              sx={{ cursor: 'pointer' }}
            />
          ))}
          <Chip
            label="Personalizado"
            onClick={() => setQuick('custom')}
            color={quick === 'custom' ? 'primary' : 'default'}
            variant={quick === 'custom' ? 'filled' : 'outlined'}
            size="small"
            sx={{ cursor: 'pointer' }}
          />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
          <TextField
            label="Desde"
            type="date"
            size="small"
            value={fechaDesde}
            onChange={(e) => { setFechaDesde(e.target.value); setQuick('custom'); }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { style: { fontSize: '0.8rem', padding: '4px 8px' } } }}
            sx={{ width: 130 }}
          />
          <TextField
            label="Hasta"
            type="date"
            size="small"
            value={fechaHasta}
            onChange={(e) => { setFechaHasta(e.target.value); setQuick('custom'); }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { style: { fontSize: '0.8rem', padding: '4px 8px' } } }}
            sx={{ width: 130 }}
          />
          <TextField
            label="Colaborador"
            size="small"
            value={colaborador}
            onChange={(e) => setColaborador(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            placeholder="Nombre o cédula"
            sx={{ width: 180 }}
            slotProps={{
              input: { endAdornment: <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />, style: { fontSize: '0.8rem' } },
              inputLabel: { style: { fontSize: '0.8rem' } },
            }}
          />
          <Button
            variant="contained"
            onClick={applyFilter}
            disabled={loading}
            size="small"
          >
            Filtrar
          </Button>
          <Chip
            label={showAbsent ? 'Ocultar ausentes' : 'Mostrar ausentes'}
            onClick={() => setShowAbsent((v) => !v)}
            color={showAbsent ? 'default' : 'default'}
            variant={showAbsent ? 'outlined' : 'filled'}
            size="small"
            icon={<PersonOffIcon sx={{ fontSize: '14px !important' }} />}
            sx={{ cursor: 'pointer', ml: 'auto' }}
          />
        </Box>
      </Paper>

      {/* ── States ── */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && error && (
        <Alert severity="error">{error}</Alert>
      )}

      {/* ── Area cards masonry ── */}
      {!loading && !error && data && (
        data.areas.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No hay datos para el período seleccionado.
          </Typography>
        ) : (
          <Box sx={{ columns: '380px', columnGap: '12px' }}>
            {data.areas.map((area) => (
              <Box key={area.areaId ?? area.areaNombre} sx={{ breakInside: 'avoid', mb: 1.5, display: 'block' }}>
                <AreaCard
                  area={area}
                  isMultiDay={isMultiDay}
                  totalDias={totalDias}
                  showAbsent={showAbsent}
                />
              </Box>
            ))}
          </Box>
        )
      )}
    </Box>
  );
}
