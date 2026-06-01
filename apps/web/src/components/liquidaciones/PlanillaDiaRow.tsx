'use client';

import Chip from '@mui/material/Chip';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { DiaLiquidacionData, Jornada, TotalesData } from '@/stores/liquidacion.store';
import { InlineHorasCell } from './InlineHorasCell';

interface Props {
  dia: DiaLiquidacionData;
  maxShifts: number;
  isReadOnly: boolean;
  onDiaUpdate: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}

const DIAS_CORTO: Record<number, string> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };

function formatFecha(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const dia = DIAS_CORTO[d.getUTCDay()];
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dia} ${dd}/${mm}`;
}

function getShift(jornadas: Jornada[] | undefined, index: number): Jornada | undefined {
  return jornadas?.[index];
}

export function PlanillaDiaRow({ dia, maxShifts, isReadOnly, onDiaUpdate }: Props) {
  const jornadas = dia.jornadas ?? [];
  const displayHoras = dia.horasAjustadasSupervisor ?? dia.horasParejadas ?? dia.horasCalculadas;
  const isAjustado = dia.horasAjustadasSupervisor !== null && dia.horasAjustadasSupervisor !== undefined;
  const cellReadOnly = isReadOnly || dia.estadoDia === 'APROBADO';

  return (
    <TableRow hover>
      {/* Date */}
      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
        <Typography variant="body2">{formatFecha(dia.fecha)}</Typography>
        {dia.tieneInconsistencia && (
          <Tooltip title="Marcaciones inconsistentes (número impar de punches)">
            <Typography component="span" color="warning.main" sx={{ ml: 0.5, fontSize: 14 }}>⚠</Typography>
          </Tooltip>
        )}
      </TableCell>

      {/* ENT/SAL pairs */}
      {Array.from({ length: maxShifts }).map((_, i) => {
        const shift = getShift(jornadas, i);
        return [
          <TableCell key={`ent-${i}`} sx={{ whiteSpace: 'nowrap', color: shift ? 'text.primary' : 'text.disabled' }}>
            {shift?.entrada ?? '—'}
          </TableCell>,
          <TableCell key={`sal-${i}`} sx={{ whiteSpace: 'nowrap', color: shift ? 'text.primary' : 'text.disabled' }}>
            {shift?.salida ?? '—'}
          </TableCell>,
        ];
      })}

      {/* Hours */}
      <TableCell sx={{ minWidth: cellReadOnly ? 64 : 300 }}>
        {cellReadOnly ? (
          <Typography variant="body2">{displayHoras.toFixed(2)}</Typography>
        ) : (
          <InlineHorasCell
            diaId={dia.id}
            currentHoras={displayHoras}
            isReadOnly={false}
            onSaved={onDiaUpdate}
          />
        )}
        {isAjustado && (
          <Chip label="Ajustado" size="small" color="info" sx={{ ml: 1 }} />
        )}
        {isAjustado && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            (orig: {(dia.horasParejadas ?? dia.horasCalculadas).toFixed(2)})
          </Typography>
        )}
      </TableCell>

      {/* Status */}
      <TableCell>
        <Typography variant="caption" color="text.secondary">{dia.estadoDia}</Typography>
      </TableCell>
    </TableRow>
  );
}
