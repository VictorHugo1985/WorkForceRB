'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { formatFecha, formatHoras, type Celda, type Tramo } from '@/lib/horas-trabajadas-types';

export interface HorasBarChartProps {
  titulo: string;
  subtitulo?: string;
  tramos: Tramo[];
  valores: Celda[];
  /** Serie de referencia (promedio) dibujada como línea; null = sin referencia. */
  referencia?: number[] | null;
  serieLabel: string;
  referenciaLabel?: string;
  /** Etiquetar el valor sobre cada columna (solo cuando son pocas). */
  etiquetarValores?: boolean;
  /** Etiqueta corta del eje X por tramo. */
  etiquetaEje: (t: Tramo) => string;
  onBarClick?: (index: number) => void;
  height?: number;
}

const M = { top: 24, right: 12, bottom: 40, left: 44 };
const BAR_MAX = 24;

function niceMax(v: number): { max: number; step: number } {
  if (v <= 0) return { max: 10, step: 2 };
  const rough = v / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  return { max: Math.ceil(v / step) * step, step };
}

/** Columna con la punta redondeada (4px) y la base recta. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function HorasBarChart({
  titulo,
  subtitulo,
  tramos,
  valores,
  referencia = null,
  serieLabel,
  referenciaLabel = 'Promedio de todos',
  etiquetarValores = false,
  etiquetaEje,
  onBarClick,
  height = 260,
}: HorasBarChartProps) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [verTabla, setVerTabla] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colores = {
    barra: theme.palette.primary.main,
    barraParcial: alpha(theme.palette.primary.main, 0.4),
    referencia: theme.palette.text.secondary,
    grid: theme.palette.divider,
    texto: theme.palette.text.secondary,
    textoFuerte: theme.palette.text.primary,
    superficie: theme.palette.background.paper,
  };

  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const band = tramos.length ? innerW / tramos.length : innerW;
  const barW = Math.max(3, Math.min(BAR_MAX, band * 0.6));

  const maxDato = Math.max(
    0,
    ...valores.map((v, i) => (tramos[i]?.sin_datos ? 0 : v.horas)),
    ...(referencia ?? []).map((v, i) => (tramos[i]?.sin_datos ? 0 : v)),
  );
  const { max, step } = niceMax(maxDato * 1.05);
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const cx = (i: number) => M.left + band * i + band / 2;
  const ticks = useMemo(() => {
    const t: number[] = [];
    for (let v = 0; v <= max + 1e-9; v += step) t.push(Math.round(v * 100) / 100);
    return t;
  }, [max, step]);

  // Etiquetas del eje X sin colisiones: mostrar 1 de cada N.
  const labelW = 44;
  const cadaN = Math.max(1, Math.ceil(labelW / band));

  const refPuntos = referencia
    ? referencia
        .map((v, i) => (tramos[i]?.sin_datos ? null : `${cx(i)},${y(v)}`))
        .filter(Boolean)
        .join(' ')
    : '';

  // Tramos "sin datos" consecutivos se agrupan en una sola franja con un único texto.
  const gruposSinDatos: { desde: number; hasta: number }[] = [];
  tramos.forEach((t, i) => {
    if (!t.sin_datos) return;
    const last = gruposSinDatos[gruposSinDatos.length - 1];
    if (last && last.hasta === i - 1) last.hasta = i;
    else gruposSinDatos.push({ desde: i, hasta: i });
  });
  // Con columnas muy angostas los marcadores se amontonan: solo la línea.
  const mostrarMarcadores = band >= 16;

  const h = hover !== null ? { t: tramos[hover], v: valores[hover], r: referencia?.[hover] } : null;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{titulo}</Typography>
          {subtitulo && <Typography variant="caption" color="text.secondary">{subtitulo}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {referencia && (
            <Box sx={{ display: 'flex', gap: 2 }} aria-hidden>
              <Leyenda color={colores.barra} label={serieLabel} tipo="barra" />
              <Leyenda color={colores.referencia} label={referenciaLabel} tipo="linea" />
            </Box>
          )}
          <Button size="small" onClick={() => setVerTabla((v) => !v)}>
            {verTabla ? 'Ver gráfico' : 'Ver tabla'}
          </Button>
        </Box>
      </Box>

      <Box ref={ref} sx={{ position: 'relative', mt: 1 }}>
      {verTabla ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Período</TableCell>
              <TableCell align="right">{serieLabel} (h)</TableCell>
              {referencia && <TableCell align="right">{referenciaLabel} (h)</TableCell>}
              <TableCell align="right">Días incompletos</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tramos.map((t, i) => (
              <TableRow key={t.key}>
                <TableCell>
                  {formatFecha(t.desde)} – {formatFecha(t.hasta)}
                  {t.parcial ? ' (parcial)' : ''}
                </TableCell>
                <TableCell align="right">{t.sin_datos ? 'sin datos' : formatHoras(valores[i].horas)}</TableCell>
                {referencia && (
                  <TableCell align="right">{t.sin_datos ? '—' : formatHoras(referencia[i])}</TableCell>
                )}
                <TableCell align="right">{t.sin_datos ? '—' : valores[i].incompletos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${titulo}: ${tramos
              .map((t, i) => `${etiquetaEje(t)} ${t.sin_datos ? 'sin datos' : `${formatHoras(valores[i].horas)} horas`}`)
              .join(', ')}`}
            style={{ display: 'block', overflow: 'visible' }}
            onMouseLeave={() => setHover(null)}
          >
            {/* Grilla y eje Y */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={colores.grid} strokeWidth={1} />
                <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={colores.texto}
                  style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t}
                </text>
              </g>
            ))}
            <text x={M.left - 6} y={M.top - 10} textAnchor="end" fontSize={11} fill={colores.texto}>h</text>

            {/* Franjas sin datos */}
            {gruposSinDatos.map((g) => {
              const x0 = M.left + band * g.desde;
              const w = band * (g.hasta - g.desde + 1);
              return (
                <g key={`sd-${g.desde}`}>
                  <rect x={x0} y={M.top} width={w} height={innerH} fill={colores.grid} opacity={0.35} />
                  {w >= 48 && (
                    <text x={x0 + w / 2} y={M.top + innerH / 2} textAnchor="middle" fontSize={11} fill={colores.texto}>
                      sin datos
                    </text>
                  )}
                </g>
              );
            })}

            {/* Columnas */}
            {tramos.map((t, i) => {
              const x = cx(i) - barW / 2;
              if (t.sin_datos) return null;
              const v = valores[i].horas;
              const top = y(v);
              return (
                <g key={t.key}>
                  <path
                    d={barPath(x, top, barW, M.top + innerH - top)}
                    fill={t.parcial ? colores.barraParcial : colores.barra}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                  {etiquetarValores && v > 0 && (
                    <text x={cx(i)} y={top - 6} textAnchor="middle" fontSize={11} fill={colores.textoFuerte}
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatHoras(v)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Línea de referencia (promedio) */}
            {referencia && refPuntos && (
              <g>
                <polyline points={refPuntos} fill="none" stroke={colores.referencia} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round" />
                {mostrarMarcadores && referencia.map((v, i) =>
                  tramos[i]?.sin_datos ? null : (
                    <circle key={i} cx={cx(i)} cy={y(v)} r={4} fill={colores.referencia}
                      stroke={colores.superficie} strokeWidth={2} />
                  ),
                )}
              </g>
            )}

            {/* Línea base */}
            <line x1={M.left} x2={width - M.right} y1={M.top + innerH} y2={M.top + innerH}
              stroke={colores.texto} strokeWidth={1} />

            {/* Eje X */}
            {tramos.map((t, i) =>
              i % cadaN === 0 ? (
                <text key={t.key} x={cx(i)} y={M.top + innerH + 16} textAnchor="middle" fontSize={11} fill={colores.texto}>
                  {etiquetaEje(t)}
                </text>
              ) : null,
            )}

            {/* Zonas de hover / clic (toda la banda, más grande que la marca) */}
            {tramos.map((t, i) => (
              <rect
                key={t.key}
                x={M.left + band * i}
                y={M.top}
                width={band}
                height={innerH}
                fill="transparent"
                style={{ cursor: onBarClick && !t.sin_datos ? 'pointer' : 'default' }}
                onMouseEnter={() => setHover(i)}
                onClick={() => !t.sin_datos && onBarClick?.(i)}
              />
            ))}
          </svg>

          {h && (
            <Paper
              elevation={3}
              sx={{
                position: 'absolute',
                pointerEvents: 'none',
                top: 0,
                left: Math.min(Math.max(cx(hover!) - 90, 0), width - 180),
                width: 180,
                p: 1,
                fontSize: 12,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                {formatFecha(h.t.desde)} – {formatFecha(h.t.hasta)}
                {h.t.parcial ? ' (parcial)' : ''}
              </Typography>
              {h.t.sin_datos ? (
                <Typography variant="caption" color="text.secondary">Sin datos</Typography>
              ) : (
                <>
                  <FilaTooltip color={colores.barra} label={serieLabel} valor={`${formatHoras(h.v.horas)} h`} />
                  {h.r !== undefined && h.r !== null && (
                    <FilaTooltip color={colores.referencia} label={referenciaLabel} valor={`${formatHoras(h.r)} h`} />
                  )}
                  {h.v.incompletos > 0 && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      ⚠ {h.v.incompletos} día{h.v.incompletos === 1 ? '' : 's'} con marcación incompleta
                    </Typography>
                  )}
                  {onBarClick && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Clic para ver el detalle diario
                    </Typography>
                  )}
                </>
              )}
            </Paper>
          )}
        </>
      )}
      </Box>
    </Paper>
  );
}

function Leyenda({ color, label, tipo }: { color: string; label: string; tipo: 'barra' | 'linea' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {tipo === 'barra' ? (
        <Box sx={{ width: 10, height: 12, bgcolor: color, borderRadius: '3px 3px 0 0' }} />
      ) : (
        <Box sx={{ width: 16, height: 2, bgcolor: color, position: 'relative' }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, position: 'absolute', top: -3, left: 4 }} />
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}

function FilaTooltip({ color, label, valor }: { color: string; label: string; valor: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
    </Box>
  );
}
