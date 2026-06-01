'use client';

import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { DiaLiquidacionData, LiquidacionData, TotalesData } from '@/stores/liquidacion.store';
import { PlanillaDiaRow } from './PlanillaDiaRow';
import { ConfirmarColaboradorButton } from './ConfirmarColaboradorButton';

interface Props {
  liquidacionId: string;
  colaboradorId: string;
  nombre: string;
  apellido: string;
  semanaId: string;
  maxShifts: number;
  tarifaHora: number | null;
  onEstadoChange: (liquidacionId: string, estado: 'APROBADO') => void;
}

function estadoChip(estado: string) {
  if (estado === 'APROBADO') return <Chip label="Aprobado" size="small" color="success" />;
  return <Chip label="Borrador" size="small" color="warning" variant="outlined" />;
}

export function LiquidacionColaborador({
  liquidacionId,
  colaboradorId,
  nombre,
  apellido,
  semanaId,
  maxShifts,
  tarifaHora,
  onEstadoChange,
}: Props) {
  const [liquidacion, setLiquidacion] = useState<LiquidacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/liquidaciones/${liquidacionId}`)
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar liquidación');
        return r.json() as Promise<LiquidacionData>;
      })
      .then((data) => setLiquidacion(data))
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
        calculadoEn: updatedTotales.calculadoEn,
      };
    });
  }, []);

  const handleConfirmed = useCallback(() => {
    setLiquidacion((prev) => prev ? { ...prev, estado: 'APROBADO' } : prev);
    onEstadoChange(liquidacionId, 'APROBADO');
  }, [liquidacionId, onEstadoChange]);

  const isLocked = liquidacion?.estado === 'APROBADO';
  const hasInconsistencias = liquidacion?.dias.some((d) => d.tieneInconsistencia) ?? false;

  // Column headers: Fecha + ENT/SAL pairs + Horas + Estado
  const shiftHeaders: string[] = [];
  for (let i = 0; i < maxShifts; i++) {
    shiftHeaders.push(`ENT.${i + 1}`, `SAL.${i + 1}`);
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Link
          href={`/liquidaciones/${semanaId}/${colaboradorId}`}
          target="_blank"
          rel="noopener"
          underline="hover"
          sx={{ fontWeight: 600, fontSize: '1rem' }}
        >
          {apellido}, {nombre}
        </Link>
        {liquidacion && estadoChip(liquidacion.estado)}
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Cargando…</Typography>
        </Box>
      )}

      {fetchError && (
        <Typography color="error" variant="body2">{fetchError}</Typography>
      )}

      {liquidacion && (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 400 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                {shiftHeaders.map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
                <TableCell sx={{ fontWeight: 600 }}>Horas</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {liquidacion.dias.map((dia) => (
                <PlanillaDiaRow
                  key={dia.id}
                  dia={dia}
                  maxShifts={maxShifts}
                  isReadOnly={isLocked}
                  onDiaUpdate={handleDiaUpdate}
                />
              ))}

              {/* Summary row */}
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={1 + maxShifts * 2} sx={{ fontWeight: 600 }}>
                  Total semana
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {liquidacion.horasOrdinarias.toFixed(2)} h
                </TableCell>
                <TableCell colSpan={1}>
                  <Typography variant="caption" color="text.secondary">
                    {tarifaHora !== null ? `${tarifaHora.toFixed(2)} Bs./h` : '—'}
                  </Typography>
                </TableCell>
              </TableRow>

              {/* Payment row */}
              <TableRow>
                <TableCell colSpan={2 + maxShifts * 2} sx={{ fontWeight: 600, color: 'success.main' }}>
                  Total a pagar: {liquidacion.totalPago.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                </TableCell>
                <TableCell colSpan={1} align="right">
                  <ConfirmarColaboradorButton
                    liquidacionId={liquidacionId}
                    hasInconsistencias={hasInconsistencias}
                    isConfirmed={isLocked}
                    onConfirmed={handleConfirmed}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
