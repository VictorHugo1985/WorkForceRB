'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';
import { InlineHorasCell } from './InlineHorasCell';

interface Props {
  dia: DiaLiquidacionData;
  isReadOnly: boolean;
  onDiaUpdate: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}

const DIAS_CORTO: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
};

function formatFecha(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${DIAS_CORTO[d.getUTCDay()]} ${dd}/${mm}`;
}

function MarcacionesDisplay({ dia }: { dia: DiaLiquidacionData }) {
  const jornadas = dia.jornadas ?? [];
  const tieneInconsistencia = dia.tieneInconsistencia;
  const marcacionSuelta = dia.marcacionSuelta;

  if (jornadas.length === 0 && !tieneInconsistencia) {
    return <Typography variant="body2" color="text.disabled">—</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
      {jornadas.map((j, i) => (
        <Typography key={i} variant="body2" component="span" sx={{ whiteSpace: 'nowrap' }}>
          {i > 0 && <Typography component="span" color="text.disabled" sx={{ mr: 0.75 }}>·</Typography>}
          {j.entrada}
          <Typography component="span" color="text.secondary" sx={{ mx: 0.5 }}>→</Typography>
          {j.salida}
        </Typography>
      ))}
      {tieneInconsistencia && marcacionSuelta && (
        <Tooltip title="Marcación sin par">
          <Typography
            variant="body2"
            component="span"
            color="warning.main"
            sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}
          >
            {jornadas.length > 0 && <span style={{ marginRight: 6, color: 'inherit' }}>·</span>}
            ⚠ {marcacionSuelta}
          </Typography>
        </Tooltip>
      )}
      {tieneInconsistencia && !marcacionSuelta && (
        <Tooltip title="Número impar de marcaciones">
          <Typography component="span" color="warning.main">⚠</Typography>
        </Tooltip>
      )}
    </Box>
  );
}

export function PlanillaDiaRow({ dia, isReadOnly, onDiaUpdate }: Props) {
  const displayHoras = dia.horasAjustadasSupervisor ?? dia.horasParejadas ?? dia.horasCalculadas;
  const isAjustado = dia.horasAjustadasSupervisor !== null && dia.horasAjustadasSupervisor !== undefined;
  const cellReadOnly = isReadOnly || dia.estadoDia === 'APROBADO';

  return (
    <TableRow hover>
      {/* Fecha */}
      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500, width: 90 }}>
        {formatFecha(dia.fecha)}
      </TableCell>

      {/* Marcaciones */}
      <TableCell>
        <MarcacionesDisplay dia={dia} />
      </TableCell>

      {/* Horas */}
      <TableCell sx={{ width: cellReadOnly ? 80 : 300 }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <Chip label="Ajustado" size="small" color="info" />
            <Typography variant="caption" color="text.secondary">
              orig: {(dia.horasParejadas ?? dia.horasCalculadas).toFixed(2)}
            </Typography>
          </Box>
        )}
      </TableCell>

      {/* Estado */}
      <TableCell sx={{ width: 110 }}>
        <Typography variant="caption" color="text.secondary">{dia.estadoDia}</Typography>
      </TableCell>
    </TableRow>
  );
}
