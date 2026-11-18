'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
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
import BusinessIcon from '@mui/icons-material/Business';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import SearchIcon from '@mui/icons-material/Search';
import type { DispositivoOption } from './page';

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
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
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

/** En oficina: marcó hoy y la última marcación es una entrada (cantidad impar de marcaciones). */
function estaEnOficina(c: ColaboradorData, hoy: string): boolean {
  const dia = c.dias.find((d) => d.fecha === hoy);
  return !!dia && dia.marcaciones.length % 2 === 1;
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
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: asistio ? 'success.main' : 'text.disabled',
          flexShrink: 0,
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 160 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: asistio ? 500 : 400, fontSize: '0.82rem' }}
        >
          {colab.apellido.split(' ')[0]}, {colab.nombre}
        </Typography>
        <Chip
          label={colab.fijo ? 'F' : 'J'}
          size="small"
          color={colab.fijo ? 'warning' : 'default'}
          variant={colab.fijo ? 'filled' : 'outlined'}
          sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, px: 0, '& .MuiChip-label': { px: '4px' } }}
        />
      </Box>

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
  totalArea,
  enOficina = false,
}: {
  area: AreaData;
  isMultiDay: boolean;
  totalDias: number;
  showAbsent: boolean;
  /** Total de colaboradores del área cuando `area` viene filtrada. */
  totalArea?: number;
  enOficina?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const presentes = area.colaboradores.filter((c) => c.dias.length > 0);
  const ausentes  = area.colaboradores.filter((c) => c.dias.length === 0);
  const total     = totalArea ?? area.colaboradores.length;
  const pct       = total > 0 ? presentes.length / total : 0;
  const color     = presenceColor(pct);

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
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
          {Math.round(pct * 100)}% {enOficina ? 'en oficina' : 'de asistencia'}
        </Typography>
      </Box>

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

type QuickFilter = 'hoy' | 'ayer' | 'semana';

interface Props {
  dispositivos: DispositivoOption[];
}

export function DashboardClient({ dispositivos }: Props) {
  const today = todayBolivia();

  const [quick, setQuick]             = useState<QuickFilter>('hoy');
  const [colaborador, setColaborador] = useState('');
  const [dispositivoSerial, setDispositivoSerial] = useState<string | null>(null);
  const [showAbsent, setShowAbsent]   = useState(true);
  const [enOficina, setEnOficina]     = useState(false);

  const [filter, setFilter] = useState({
    fechaDesde: today,
    fechaHasta: today,
    colaborador: '',
    dispositivoSerial: null as string | null,
  });

  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const filterRef = useRef(filter);
  filterRef.current = filter;

  const dateRangeFor = (q: QuickFilter): { desde: string; hasta: string } => {
    const t = todayBolivia();
    if (q === 'ayer')   { const y = subtractDays(t, 1); return { desde: y, hasta: y }; }
    if (q === 'semana') return { desde: startOfWeekBolivia(t), hasta: t };
    return { desde: t, hasta: t };
  };

  const doFetch = useCallback((silent: boolean) => {
    const f = filterRef.current;
    const params = new URLSearchParams({ fecha_desde: f.fechaDesde, fecha_hasta: f.fechaHasta });
    if (f.colaborador)      params.set('colaborador', f.colaborador);
    if (f.dispositivoSerial) params.set('dispositivo', f.dispositivoSerial);

    if (silent) { setRefreshing(true); }
    else        { setLoading(true); setError(null); }

    fetch(`/api/dashboard/asistencia?${params}`)
      .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json() as Promise<DashboardData>; })
      .then(setData)
      .catch((e: Error) => { if (!silent) setError((e as Error).message); })
      .finally(() => { if (silent) setRefreshing(false); else setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-apply date chip changes
  useEffect(() => {
    const { desde, hasta } = dateRangeFor(quick);
    setFilter((prev) => ({ ...prev, fechaDesde: desde, fechaHasta: hasta }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick]);

  // Auto-apply device chip changes
  useEffect(() => {
    setFilter((prev) => ({ ...prev, dispositivoSerial }));
  }, [dispositivoSerial]);

  // Fetch on filter change
  useEffect(() => {
    doFetch(false);
  }, [filter, doFetch]);

  // 60-second auto-refresh for "Hoy"
  useEffect(() => {
    if (quick !== 'hoy') return;
    const id = setInterval(() => doFetch(true), 60_000);
    return () => clearInterval(id);
  }, [quick, doFetch]);

  const applyColaborador = useCallback(() => {
    setFilter((prev) => ({ ...prev, colaborador }));
  }, [colaborador]);

  const isMultiDay = filter.fechaDesde !== filter.fechaHasta;
  const totalDias  = isMultiDay ? diasEnRango(filter.fechaDesde, filter.fechaHasta) : 1;

  // "En oficina" solo aplica a hoy: marcaron hoy y todavía no marcaron salida.
  const filtroOficina = enOficina && quick === 'hoy';
  const hoyData = data?.fechaHasta ?? today;
  const areasVista = !data
    ? []
    : filtroOficina
      ? data.areas
          .map((a) => ({
            area: { ...a, colaboradores: a.colaboradores.filter((c) => estaEnOficina(c, hoyData)) },
            totalArea: a.colaboradores.length,
          }))
          .filter((x) => x.area.colaboradores.length > 0)
      : data.areas.map((a) => ({ area: a, totalArea: undefined as number | undefined }));
  const totalEnOficina = filtroOficina ? areasVista.reduce((s, x) => s + x.area.colaboradores.length, 0) : 0;

  return (
    <Box>
      <LinearProgress
        variant="indeterminate"
        sx={{ height: 2, mb: 0.5, opacity: refreshing ? 1 : 0, transition: 'opacity 0.3s' }}
      />

      <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Date chips */}
          {(['hoy', 'ayer', 'semana'] as const).map((q) => (
            <Chip
              key={q}
              label={q === 'hoy' ? 'Hoy' : q === 'ayer' ? 'Ayer' : 'Esta semana'}
              onClick={() => { setQuick(q); if (q !== 'hoy') setEnOficina(false); }}
              color={quick === q ? 'primary' : 'default'}
              variant={quick === q ? 'filled' : 'outlined'}
              size="small"
              sx={{ cursor: 'pointer' }}
            />
          ))}

          {/* Device chips — shown only when there are devices */}
          {dispositivos.length > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
              <Chip
                label="Todos"
                onClick={() => setDispositivoSerial(null)}
                color={dispositivoSerial === null ? 'secondary' : 'default'}
                variant={dispositivoSerial === null ? 'filled' : 'outlined'}
                size="small"
                sx={{ cursor: 'pointer' }}
              />
              {dispositivos.map((d) => (
                <Chip
                  key={d.serial}
                  label={d.nombre}
                  onClick={() => setDispositivoSerial(d.serial)}
                  color={dispositivoSerial === d.serial ? 'secondary' : 'default'}
                  variant={dispositivoSerial === d.serial ? 'filled' : 'outlined'}
                  size="small"
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </>
          )}

          {/* Collaborator search */}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
          <TextField
            label="Colaborador"
            size="small"
            value={colaborador}
            onChange={(e) => setColaborador(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyColaborador()}
            placeholder="Nombre o cédula"
            sx={{ width: 180 }}
            slotProps={{
              input: { endAdornment: <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />, style: { fontSize: '0.8rem' } },
              inputLabel: { style: { fontSize: '0.8rem' } },
            }}
          />

          {/* En oficina: marcaron hoy y aún no marcaron salida */}
          <Tooltip title="Personal con marcaciones de hoy que todavía no marcó salida">
            <Chip
              label={filtroOficina && data ? `En oficina (${totalEnOficina})` : 'En oficina'}
              onClick={() => {
                const v = !enOficina;
                setEnOficina(v);
                if (v && quick !== 'hoy') setQuick('hoy');
              }}
              color={filtroOficina ? 'primary' : 'default'}
              variant={filtroOficina ? 'filled' : 'outlined'}
              size="small"
              icon={<BusinessIcon sx={{ fontSize: '14px !important' }} />}
              sx={{ cursor: 'pointer', ml: 'auto' }}
            />
          </Tooltip>

          {/* Absent toggle */}
          <Chip
            label={showAbsent ? 'Ocultar ausentes' : 'Mostrar ausentes'}
            onClick={() => setShowAbsent((v) => !v)}
            variant={showAbsent ? 'outlined' : 'filled'}
            size="small"
            icon={<PersonOffIcon sx={{ fontSize: '14px !important' }} />}
            disabled={filtroOficina}
            sx={{ cursor: 'pointer' }}
          />
        </Box>
      </Paper>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && error && (
        <Alert severity="error">{error}</Alert>
      )}

      {!loading && !error && data && (
        areasVista.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            {filtroOficina ? 'No hay personal en oficina en este momento.' : 'No hay datos para el período seleccionado.'}
          </Typography>
        ) : (
          <Box sx={{ columns: '380px', columnGap: '12px' }}>
            {areasVista.map(({ area, totalArea }) => (
              <Box key={area.areaId ?? area.areaNombre} sx={{ breakInside: 'avoid', mb: 1.5, display: 'block' }}>
                <AreaCard
                  area={area}
                  isMultiDay={isMultiDay}
                  totalDias={totalDias}
                  showAbsent={showAbsent && !filtroOficina}
                  totalArea={totalArea}
                  enOficina={filtroOficina}
                />
              </Box>
            ))}
          </Box>
        )
      )}
    </Box>
  );
}
