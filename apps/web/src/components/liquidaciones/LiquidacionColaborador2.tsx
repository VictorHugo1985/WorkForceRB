'use client';

import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { DiaLiquidacionData, LiquidacionData, TotalesData } from '@/stores/liquidacion.store';
import { PlanillaDiaRow } from './PlanillaDiaRow';
import {
  TarifaEditor,
  Stat,
  ConfirmarButton,
  PagarButton,
  type EstadoLiquidacion,
} from './LiquidacionColaborador';

interface Props {
  liquidacionId: string;
  colaboradorId: string;
  nombre: string;
  apellido: string;
  semanaId: string;
  tarifaHora: number | null;
  onEstadoChange: (liquidacionId: string, estado: EstadoLiquidacion) => void;
}

export function LiquidacionColaborador2({
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

  useEffect(() => {
    fetch(`/api/liquidaciones/${liquidacionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar');
        return r.json() as Promise<LiquidacionData>;
      })
      .then(setLiquidacion)
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoading(false));
  }, [liquidacionId]);

  const handleDiaUpdate = useCallback((updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => {
    setLiquidacion((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        dias: prev.dias.map((d) => (d.id === updatedDia.id ? updatedDia : d)),
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
    setLiquidacion((prev) => (prev ? { ...prev, estado: 'APROBADO' } : prev));
    onEstadoChange(liquidacionId, 'APROBADO');
  }, [liquidacionId, onEstadoChange]);

  const handlePagado = useCallback(() => {
    setLiquidacion((prev) => (prev ? { ...prev, estado: 'PAGADO' } : prev));
    onEstadoChange(liquidacionId, 'PAGADO');
  }, [liquidacionId, onEstadoChange]);

  const estado = (liquidacion?.estado ?? null) as EstadoLiquidacion | null;
  const isAprobado = estado === 'APROBADO';
  const isPagado = estado === 'PAGADO';
  const isLocked = isAprobado || isPagado;
  const hasInconsistencias = liquidacion?.dias.some((d) => d.tieneInconsistencia) ?? false;

  const borderColorMap: Record<EstadoLiquidacion, string> = {
    BORRADOR: 'divider',
    APROBADO: 'success.main',
    PAGADO: 'secondary.main',
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
      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          {/* Collaborator header row */}
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell colSpan={6} sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.97rem', lineHeight: 1.2 }}>
                  {apellido}, {nombre}
                </Typography>
                {estado === 'BORRADOR' && <Chip label="Borrador" size="small" color="default" variant="outlined" />}
                {estado === 'APROBADO' && <Chip label="✓ Aprobado" size="small" color="success" />}
                {estado === 'PAGADO'   && <Chip label="💰 Pagado" size="small" color="secondary" />}

                {loading && (
                  <Box sx={{ display: 'flex', gap: 1.5, ml: 1 }}>
                    {[80, 60, 80, 100].map((w, i) => (
                      <Skeleton key={i} variant="rounded" width={w} height={24} />
                    ))}
                  </Box>
                )}

                {liquidacion && (
                  <>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <TarifaEditor
                      colaboradorId={colaboradorId}
                      value={localTarifa}
                      readOnly={isPagado}
                      onChange={setLocalTarifa}
                    />
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
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
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
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
                    <Box sx={{ ml: 'auto' }}>
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
                  </>
                )}
              </Box>
              {fetchError && (
                <Typography color="error" variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  {fetchError}
                </Typography>
              )}
            </TableCell>
          </TableRow>

          {/* Column headers */}
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 600, width: 90, color: 'text.secondary', fontSize: '0.75rem' }}>Fecha</TableCell>
            <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', py: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 108, textAlign: 'center', fontWeight: 600 }}>Entrada</Box>
                <Box sx={{ width: 18 }} />
                <Box sx={{ width: 108, textAlign: 'center', fontWeight: 600 }}>Salida</Box>
              </Box>
            </TableCell>
            <TableCell sx={{ fontWeight: 600, width: 80, color: 'text.secondary', fontSize: '0.75rem' }}>Horas</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 185, color: 'text.secondary', fontSize: '0.75rem' }}>Tipo ajuste</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 140, color: 'text.secondary', fontSize: '0.75rem' }}>Monto ajuste</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 100, color: 'text.secondary', fontSize: '0.75rem' }}>Estado</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={6} sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} variant="rounded" height={36} />
                  ))}
                </Box>
              </TableCell>
            </TableRow>
          )}

          {!loading && liquidacion && liquidacion.dias.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  Sin días registrados esta semana.
                </Typography>
              </TableCell>
            </TableRow>
          )}

          {!loading && liquidacion && liquidacion.dias.map((dia) => (
            <PlanillaDiaRow
              key={dia.id}
              dia={dia}
              isReadOnly={isLocked}
              tarifaHora={localTarifa}
              highlightEmptyMarcaciones={true}
              onDiaUpdate={handleDiaUpdate}
            />
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
