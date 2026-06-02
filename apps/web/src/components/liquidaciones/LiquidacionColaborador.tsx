'use client';

import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
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
  tarifaHora: number | null;
  onEstadoChange: (liquidacionId: string, estado: 'APROBADO') => void;
}

export function LiquidacionColaborador({
  liquidacionId,
  colaboradorId,
  nombre,
  apellido,
  semanaId,
  tarifaHora,
  onEstadoChange,
}: Props) {
  const [liquidacion, setLiquidacion] = useState<LiquidacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: isLocked ? 'success.light' : 'divider',
        opacity: isLocked ? 0.85 : 1,
      }}
    >
      {/* ── Collaborator header ── */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: isLocked ? 'success.50' : 'background.default',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Link
            href={`/liquidaciones/${semanaId}/${colaboradorId}`}
            target="_blank"
            rel="noopener"
            underline="hover"
            sx={{ fontWeight: 600, fontSize: '0.95rem' }}
          >
            {apellido}, {nombre}
          </Link>
          {liquidacion && (
            liquidacion.estado === 'APROBADO'
              ? <Chip label="Aprobado" size="small" color="success" />
              : <Chip label="Borrador" size="small" color="warning" variant="outlined" />
          )}
        </Box>

        {liquidacion && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {liquidacion.horasOrdinarias.toFixed(2)} h
              {tarifaHora !== null && (
                <> · {tarifaHora.toFixed(2)} Bs./h</>
              )}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }} color="success.dark">
              {liquidacion.totalPago.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
            </Typography>
            <ConfirmarColaboradorButton
              liquidacionId={liquidacionId}
              hasInconsistencias={hasInconsistencias}
              isConfirmed={isLocked}
              onConfirmed={handleConfirmed}
            />
          </Box>
        )}
      </Box>

      <Divider />

      {/* ── Loading / error states ── */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Cargando…</Typography>
        </Box>
      )}
      {fetchError && (
        <Typography color="error" variant="body2" sx={{ px: 2, py: 1 }}>{fetchError}</Typography>
      )}

      {/* ── Days table ── */}
      {liquidacion && liquidacion.dias.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 600, width: 90 }}>Fecha</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Marcaciones</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Horas</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 110 }}>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {liquidacion.dias.map((dia) => (
              <PlanillaDiaRow
                key={dia.id}
                dia={dia}
                isReadOnly={isLocked}
                onDiaUpdate={handleDiaUpdate}
              />
            ))}
          </TableBody>
        </Table>
      )}
      {liquidacion && liquidacion.dias.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          Sin días registrados.
        </Typography>
      )}
    </Paper>
  );
}
