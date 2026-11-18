'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useSnackbar } from '@/lib/SnackbarContext';
import {
  formatFecha,
  formatHoras,
  MESES_CORTOS,
  PERIODO_LABEL,
  type Celda,
  type FilaColaborador,
  type Periodo,
  type ReporteHorasResponse,
  type Tramo,
} from '@/lib/horas-trabajadas-types';
import { HorasBarChart } from './HorasBarChart';
import { DetalleHorasDialog } from './DetalleHorasDialog';

const PROMEDIO_ID = '__promedio__';

interface Opcion {
  id: string;
  label: string;
  sub?: string;
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Promedio por tramo sobre la base de colaboradores (activos con horas en el período). */
function promedioSerie(base: FilaColaborador[], key: 'mes' | 'semana', n: number): number[] {
  if (base.length === 0) return Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => base.reduce((s, c) => s + c[key][i].horas, 0) / base.length);
}

/** Promedio de horas por tramo, solo con tramos completos y con datos. */
function promedioPorTramo(tramos: Tramo[], horas: number[]): number | null {
  const vals = horas.filter((_, i) => !tramos[i].sin_datos && !tramos[i].parcial);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function HorasTrabajadasClient({ initial }: { initial: ReporteHorasResponse }) {
  const { showError } = useSnackbar();
  const router = useRouter();

  const [data, setData] = useState(initial);
  const [periodo, setPeriodo] = useState<Periodo>(initial.periodo);
  const [loading, setLoading] = useState(false);
  const [seleccion, setSeleccion] = useState<string>(PROMEDIO_ID);
  const [detalle, setDetalle] = useState<Tramo | null>(null);

  const cargar = useCallback(
    async (p: Periodo) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/horas-trabajadas?periodo=${p}`);
        if (res.status === 401) {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          router.push('/login?reason=expired');
          return;
        }
        if (!res.ok) { showError('Error al cargar las horas trabajadas.'); return; }
        setData(await res.json());
      } catch {
        showError('Error de conexión.');
      } finally {
        setLoading(false);
      }
    },
    [router, showError],
  );

  const base = useMemo(() => data.colaboradores.filter((c) => c.activo && c.total_horas > 0), [data]);

  const opciones: Opcion[] = useMemo(
    () => [
      { id: PROMEDIO_ID, label: 'Promedio de todos los colaboradores', sub: `${base.length} colaboradores con marcaciones` },
      ...[...data.colaboradores]
        .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'))
        .map((c) => ({
          id: c.id,
          label: `${c.apellido}, ${c.nombre}`,
          sub: [c.cedula, c.area_nombre ?? 'Sin área', c.activo ? null : 'Inactivo'].filter(Boolean).join(' · '),
        })),
    ],
    [data.colaboradores, base.length],
  );

  const colaborador = seleccion === PROMEDIO_ID ? null : data.colaboradores.find((c) => c.id === seleccion) ?? null;
  // Si cambia el período y el colaborador ya no figura, se vuelve al promedio.
  const esPromedio = colaborador === null;

  const promMes = useMemo(() => promedioSerie(base, 'mes', data.tramos_mes.length), [base, data.tramos_mes.length]);
  const promSemana = useMemo(
    () => promedioSerie(base, 'semana', data.tramos_semana.length),
    [base, data.tramos_semana.length],
  );

  const toCeldas = (v: number[]): Celda[] => v.map((h) => ({ horas: h, incompletos: 0 }));
  const serieMes: Celda[] = colaborador ? colaborador.mes : toCeldas(promMes);
  const serieSemana: Celda[] = colaborador ? colaborador.semana : toCeldas(promSemana);

  const totalPeriodo = colaborador
    ? colaborador.total_horas
    : base.length
      ? base.reduce((s, c) => s + c.total_horas, 0) / base.length
      : 0;
  const promSemanal = promedioPorTramo(data.tramos_semana, serieSemana.map((c) => c.horas));
  const promMensual = promedioPorTramo(data.tramos_mes, serieMes.map((c) => c.horas));

  const serieLabel = colaborador ? `${colaborador.apellido}, ${colaborador.nombre}` : 'Promedio por colaborador';
  const valorOpcion = opciones.find((o) => o.id === (colaborador ? colaborador.id : PROMEDIO_ID)) ?? opciones[0];

  const etiquetaMes = (t: Tramo) => {
    const m = Number(t.key.slice(5, 7)) - 1;
    return `${MESES_CORTOS[m]}${t.key.slice(2, 4) !== data.hasta.slice(2, 4) ? ` ${t.key.slice(2, 4)}` : ''}`;
  };
  const etiquetaSemana = (t: Tramo) => `${t.desde.slice(8, 10)}/${t.desde.slice(5, 7)}`;

  return (
    <Box>
      {/* Controles: colaborador + período, en una fila */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <Autocomplete
          size="small"
          sx={{ minWidth: 300, flex: { xs: '1 1 100%', sm: '0 1 380px' } }}
          options={opciones}
          value={valorOpcion}
          disableClearable
          isOptionEqualToValue={(o, v) => o.id === v.id}
          getOptionLabel={(o) => o.label}
          filterOptions={(opts, { inputValue }) => {
            const q = normalizar(inputValue.trim());
            if (!q) return opts;
            return opts.filter((o) => o.id === PROMEDIO_ID || normalizar(`${o.label} ${o.sub ?? ''}`).includes(q));
          }}
          onChange={(_, o) => setSeleccion(o.id)}
          renderOption={(props, o) => {
            const { key, ...rest } = props as typeof props & { key: string };
            return (
              <li key={key} {...rest}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: o.id === PROMEDIO_ID ? 600 : 400 }}>{o.label}</Typography>
                  {o.sub && <Typography variant="caption" color="text.secondary">{o.sub}</Typography>}
                </Box>
              </li>
            );
          }}
          renderInput={(params) => <TextField {...params} label="Colaborador" />}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          color="primary"
          value={periodo}
          disabled={loading}
          onChange={(_, v: Periodo | null) => {
            if (v && v !== periodo) {
              setPeriodo(v);
              cargar(v);
            }
          }}
        >
          {(['trimestre', 'semestre', 'anio'] as Periodo[]).map((p) => (
            <ToggleButton key={p} value={p}>{PERIODO_LABEL[p]}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">
          Del {formatFecha(data.desde)} al {formatFecha(data.hasta)}
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Indicadores */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        <Indicador
          label={esPromedio ? 'Horas del período (promedio)' : 'Horas del período'}
          valor={`${formatHoras(totalPeriodo)} h`}
        />
        <Indicador label="Promedio semanal" valor={promSemanal === null ? '—' : `${formatHoras(promSemanal)} h`} nota="semanas completas" />
        <Indicador label="Promedio mensual" valor={promMensual === null ? '—' : `${formatHoras(promMensual)} h`} nota="meses completos" />
        {esPromedio ? (
          <Indicador label="Colaboradores considerados" valor={String(base.length)} nota="activos con marcaciones" />
        ) : (
          <Indicador
            label="Días con marcación incompleta"
            valor={String(colaborador!.total_incompletos)}
            nota={colaborador!.total_incompletos > 0 ? 'no suman horas' : undefined}
            alerta={colaborador!.total_incompletos > 0}
          />
        )}
      </Box>

      {/* Gráficos */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <HorasBarChart
          titulo="Horas por semana"
          subtitulo={esPromedio ? 'Promedio por colaborador, lunes a domingo' : 'Lunes a domingo'}
          tramos={data.tramos_semana}
          valores={serieSemana}
          referencia={colaborador ? promSemana : null}
          serieLabel={serieLabel}
          etiquetaEje={etiquetaSemana}
          onBarClick={colaborador ? (i) => setDetalle(data.tramos_semana[i]) : undefined}
        />
        <HorasBarChart
          titulo="Horas por mes"
          subtitulo={esPromedio ? 'Promedio por colaborador' : undefined}
          tramos={data.tramos_mes}
          valores={serieMes}
          referencia={colaborador ? promMes : null}
          serieLabel={serieLabel}
          etiquetarValores
          etiquetaEje={etiquetaMes}
          onBarClick={
            colaborador
              ? (i) => {
                  const t = data.tramos_mes[i];
                  // El detalle admite hasta 31 días: un mes entra completo.
                  setDetalle(t);
                }
              : undefined
          }
        />
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Horas calculadas solo con las marcaciones del reloj biométrico. El promedio considera a los colaboradores activos
        con al menos una marcación en el período. Las columnas claras son períodos en curso (parciales).
        {colaborador ? ' Haga clic en una columna para ver el detalle diario.' : ' Seleccione un colaborador para ver sus horas.'}
      </Typography>

      <DetalleHorasDialog
        open={detalle !== null && colaborador !== null}
        onClose={() => setDetalle(null)}
        colaborador={colaborador}
        tramo={detalle}
      />
    </Box>
  );
}

function Indicador({ label, valor, nota, alerta }: { label: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        {alerta && <Box component="span" sx={{ color: 'warning.main', mr: 0.5 }} aria-label="Advertencia">⚠</Box>}
        {valor}
      </Typography>
      {nota && <Typography variant="caption" color="text.secondary">{nota}</Typography>}
    </Paper>
  );
}
