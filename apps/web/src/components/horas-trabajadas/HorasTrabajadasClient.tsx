'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useSnackbar } from '@/lib/SnackbarContext';
import {
  formatFecha,
  formatHoras,
  PERIODO_LABEL,
  type Agrupacion,
  type FilaColaborador,
  type Periodo,
  type ReporteHorasResponse,
  type Tramo,
} from '@/lib/horas-trabajadas-types';
import { DetalleHorasDialog } from './DetalleHorasDialog';

const STORAGE_KEY = 'horas-trabajadas:vista';
const SIN_AREA = '__sin_area__';

type SortKey = 'nombre' | 'total';

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function semanaNumero(key: string): string {
  return key.includes('-W') ? `Sem ${Number(key.split('-W')[1])}` : '';
}

const stickySx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  bgcolor: 'background.paper',
  borderRight: 1,
  borderRightColor: 'divider',
} as const;

export function HorasTrabajadasClient({ initial }: { initial: ReporteHorasResponse }) {
  const { showError } = useSnackbar();
  const router = useRouter();

  const [data, setData] = useState(initial);
  const [periodo, setPeriodo] = useState<Periodo>(initial.periodo);
  const [agrupacion, setAgrupacion] = useState<Agrupacion>(initial.agrupacion);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'nombre', dir: 'asc' });

  const [detalle, setDetalle] = useState<{ colaborador: FilaColaborador; tramo: Tramo } | null>(null);

  const restored = useRef(false);

  const cargar = useCallback(
    async (p: Periodo, a: Agrupacion) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/horas-trabajadas?periodo=${p}&agrupacion=${a}`);
        if (res.status === 401) {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          router.push('/login?reason=expired');
          return;
        }
        if (!res.ok) { showError('Error al cargar el reporte de horas.'); return; }
        setData(await res.json());
      } catch {
        showError('Error de conexión.');
      } finally {
        setLoading(false);
      }
    },
    [router, showError],
  );

  const cambiarVista = (p: Periodo, a: Agrupacion) => {
    setPeriodo(p);
    setAgrupacion(a);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ periodo: p, agrupacion: a })); } catch { /* sin storage */ }
    cargar(p, a);
  };

  // Restaura la última vista elegida (preferencia por usuario/navegador).
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      const okP = ['trimestre', 'semestre', 'anio'].includes(saved?.periodo);
      const okA = ['mes', 'semana'].includes(saved?.agrupacion);
      if (okP && okA && (saved.periodo !== initial.periodo || saved.agrupacion !== initial.agrupacion)) {
        setPeriodo(saved.periodo);
        setAgrupacion(saved.agrupacion);
        cargar(saved.periodo, saved.agrupacion);
      }
    } catch { /* sin storage */ }
  }, [cargar, initial.periodo, initial.agrupacion]);

  const filas = useMemo(() => {
    const nq = normalizar(q.trim());
    let rows = data.colaboradores.filter((c) => {
      if (!incluirInactivos && !c.activo) return false;
      if (area === SIN_AREA && c.area_id) return false;
      if (area && area !== SIN_AREA && c.area_id !== area) return false;
      if (nq) {
        const hay = normalizar(`${c.nombre} ${c.apellido} ${c.apellido} ${c.nombre} ${c.cedula}`);
        if (!hay.includes(nq)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const cmp =
        sort.key === 'total'
          ? a.total_horas - b.total_horas
          : `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es');
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data.colaboradores, q, area, incluirInactivos, sort]);

  const totales = useMemo(() => {
    const porTramo = data.tramos.map((_, i) => filas.reduce((s, f) => s + f.celdas[i].horas, 0));
    const total = filas.reduce((s, f) => s + f.total_horas, 0);
    const n = filas.length || 1;
    return { porTramo, total, promTramo: porTramo.map((x) => x / n), promTotal: total / n };
  }, [filas, data.tramos]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'total' ? 'desc' : 'asc' },
    );

  const hayInactivos = data.colaboradores.some((c) => !c.activo);
  const semanal = data.agrupacion === 'semana';

  return (
    <Box>
      {/* Vista */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={periodo}
          onChange={(_, v: Periodo | null) => v && v !== periodo && cambiarVista(v, agrupacion)}
          disabled={loading}
        >
          {(['trimestre', 'semestre', 'anio'] as Periodo[]).map((p) => (
            <ToggleButton key={p} value={p}>{PERIODO_LABEL[p]}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={agrupacion}
          onChange={(_, v: Agrupacion | null) => v && v !== agrupacion && cambiarVista(periodo, v)}
          disabled={loading}
        >
          <ToggleButton value="mes">Por mes</ToggleButton>
          <ToggleButton value="semana">Por semana</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          Del {formatFecha(data.desde)} al {formatFecha(data.hasta)}
        </Typography>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por nombre o cédula"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 240, flex: { xs: 1, sm: 'none' } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="area-label">Área</InputLabel>
          <Select labelId="area-label" label="Área" value={area} onChange={(e) => setArea(e.target.value)}>
            <MenuItem value="">Todas las áreas</MenuItem>
            {data.areas.map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
            ))}
            <MenuItem value={SIN_AREA}>Sin área</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={<Switch checked={incluirInactivos} onChange={(e) => setIncluirInactivos(e.target.checked)} />}
          label="Incluir inactivos"
          disabled={!hayInactivos}
        />
        <Typography variant="body2" color="text.secondary">
          {filas.length} colaborador{filas.length === 1 ? '' : 'es'}
        </Typography>
      </Box>

      <Paper variant="outlined">
        {loading && <LinearProgress />}
        <TableContainer sx={{ maxHeight: '70vh' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...stickySx, zIndex: 3, minWidth: 200 }}>
                  <TableSortLabel
                    active={sort.key === 'nombre'}
                    direction={sort.key === 'nombre' ? sort.dir : 'asc'}
                    onClick={() => toggleSort('nombre')}
                  >
                    Colaborador
                  </TableSortLabel>
                </TableCell>
                {data.tramos.map((t) => (
                  <TableCell key={t.key} align="right" sx={{ minWidth: semanal ? 84 : 92, whiteSpace: 'nowrap' }}>
                    <Box sx={{ lineHeight: 1.2 }}>
                      {t.etiqueta}
                      {semanal && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {semanaNumero(t.key)}
                        </Typography>
                      )}
                      {t.parcial && (
                        <Chip label="parcial" size="small" variant="outlined" sx={{ height: 18, fontSize: 10, mt: 0.25 }} />
                      )}
                    </Box>
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ minWidth: 96, fontWeight: 700 }}>
                  <TableSortLabel
                    active={sort.key === 'total'}
                    direction={sort.key === 'total' ? sort.dir : 'desc'}
                    onClick={() => toggleSort('total')}
                  >
                    Total
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filas.map((c) => (
                <TableRow key={c.id} hover sx={{ opacity: c.activo ? 1 : 0.6 }}>
                  <TableCell sx={stickySx}>
                    <Typography variant="body2" noWrap>
                      {c.apellido}, {c.nombre}
                      {!c.activo && <Chip label="Inactivo" size="small" sx={{ ml: 1, height: 18 }} />}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      {c.area_nombre ?? 'Sin área'}
                    </Typography>
                  </TableCell>
                  {data.tramos.map((t, i) => {
                    const cel = c.celdas[i];
                    if (t.sin_datos) {
                      return (
                        <TableCell key={t.key} align="right" sx={{ color: 'text.disabled', fontSize: 12 }}>
                          sin datos
                        </TableCell>
                      );
                    }
                    const clickable = cel.horas > 0 || cel.incompletos > 0;
                    return (
                      <TableCell
                        key={t.key}
                        align="right"
                        onClick={clickable ? () => setDetalle({ colaborador: c, tramo: t }) : undefined}
                        sx={{
                          whiteSpace: 'nowrap',
                          cursor: clickable ? 'pointer' : 'default',
                          color: cel.horas === 0 ? 'text.secondary' : 'inherit',
                          '&:hover': clickable ? { bgcolor: 'action.hover' } : undefined,
                        }}
                      >
                        {formatHoras(cel.horas)}
                        {cel.incompletos > 0 && (
                          <Tooltip
                            title={`${cel.incompletos} día${cel.incompletos === 1 ? '' : 's'} con marcaciones incompletas`}
                          >
                            <Box
                              component="span"
                              sx={{ ml: 0.5, color: 'warning.main', display: 'inline-flex', alignItems: 'center', fontSize: 12 }}
                            >
                              <WarningAmberIcon sx={{ fontSize: 14 }} />
                              {cel.incompletos}
                            </Box>
                          </Tooltip>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {formatHoras(c.total_horas)}
                    {c.total_incompletos > 0 && (
                      <Box component="span" sx={{ ml: 0.5, color: 'warning.main', fontSize: 12 }}>
                        ⚠{c.total_incompletos}
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={data.tramos.length + 2} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No hay colaboradores para mostrar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filas.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell sx={{ ...stickySx, fontWeight: 700, color: 'text.primary' }}>Total</TableCell>
                  {data.tramos.map((t, i) => (
                    <TableCell key={t.key} align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {t.sin_datos ? '—' : formatHoras(totales.porTramo[i])}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    {formatHoras(totales.total)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ ...stickySx, color: 'text.secondary' }}>Promedio por colaborador</TableCell>
                  {data.tramos.map((t, i) => (
                    <TableCell key={t.key} align="right" sx={{ color: 'text.secondary' }}>
                      {t.sin_datos ? '—' : formatHoras(totales.promTramo[i])}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>
                    {formatHoras(totales.promTotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Las horas se calculan solo con las marcaciones del reloj. ⚠ = días con una marcación sin pareja (no suma horas).
        Haga clic en una celda para ver el detalle diario.
      </Typography>

      <DetalleHorasDialog
        open={detalle !== null}
        onClose={() => setDetalle(null)}
        colaborador={detalle?.colaborador ?? null}
        tramo={detalle?.tramo ?? null}
      />
    </Box>
  );
}
