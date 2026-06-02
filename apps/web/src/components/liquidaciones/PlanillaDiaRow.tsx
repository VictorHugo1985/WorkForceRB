'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/Edit';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';
import { InlineDiaEditor } from './InlineDiaEditor';

interface Props {
  dia: DiaLiquidacionData;
  isReadOnly: boolean;
  tarifaHora: number | null;
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

function estadoChip(estado: string) {
  switch (estado) {
    case 'APROBADO':
      return <Chip label="Aprobado" size="small" color="success" />;
    case 'CON_AJUSTE_HORAS':
      return <Chip label="H. ajust." size="small" color="info" />;
    case 'CON_DESCUENTO':
      return <Chip label="Ajuste" size="small" color="warning" />;
    case 'CON_AJUSTE_Y_DESCUENTO':
      return <Chip label="H. + ajuste" size="small" color="warning" />;
    default:
      return <Chip label="Sin rev." size="small" variant="outlined" />;
  }
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
          {i > 0 && (
            <Typography component="span" color="text.disabled" sx={{ mr: 0.75 }}>·</Typography>
          )}
          {j.entrada}
          <Typography component="span" color="text.secondary" sx={{ mx: 0.5 }}>→</Typography>
          {j.salida}
        </Typography>
      ))}
      {tieneInconsistencia && marcacionSuelta && (
        <Tooltip title="Marcación sin par — expandir para completar">
          <Typography
            variant="body2"
            component="span"
            color="warning.main"
            sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}
          >
            {jornadas.length > 0 && (
              <span style={{ marginRight: 6, color: 'inherit' }}>·</span>
            )}
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

function AjusteLabel({ dia }: { dia: DiaLiquidacionData }) {
  if (!dia.ajusteTipo) return null;
  const label = dia.ajusteTipo === 'TARIFA_DIA'
    ? `Tarifa: ${dia.ajusteValor?.toFixed(2) ?? '?'} Bs./h`
    : `Fijo: ${dia.ajusteValor?.toFixed(2) ?? '?'} Bs.`;
  return (
    <Tooltip title={dia.ajusteDescripcion ?? ''}>
      <Chip label={label} size="small" color="warning" sx={{ mt: 0.25 }} />
    </Tooltip>
  );
}

export function PlanillaDiaRow({ dia, isReadOnly, tarifaHora, onDiaUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);

  const displayHoras = dia.horasAjustadasSupervisor ?? dia.horasParejadas ?? dia.horasCalculadas;
  const isAjustado = dia.horasAjustadasSupervisor !== null && dia.horasAjustadasSupervisor !== undefined;
  const cellReadOnly = isReadOnly || dia.estadoDia === 'APROBADO';

  const handleSaved = (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => {
    onDiaUpdate(updatedDia, updatedTotales);
    setExpanded(false);
  };

  return (
    <>
      <TableRow hover sx={{ '& > td': { borderBottom: expanded ? 'none' : undefined } }}>
        {/* Fecha */}
        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500, width: 90 }}>
          {formatFecha(dia.fecha)}
        </TableCell>

        {/* Marcaciones */}
        <TableCell>
          <MarcacionesDisplay dia={dia} />
        </TableCell>

        {/* Horas */}
        <TableCell sx={{ width: 120 }}>
          <Typography variant="body2">{displayHoras.toFixed(2)} h</Typography>
          {isAjustado && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <Chip label="Ajustado" size="small" color="info" />
              <Typography variant="caption" color="text.secondary">
                orig: {(dia.horasParejadas ?? dia.horasCalculadas).toFixed(2)}
              </Typography>
            </Box>
          )}
        </TableCell>

        {/* Estado + ajuste */}
        <TableCell sx={{ width: 130 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {estadoChip(dia.estadoDia)}
            <AjusteLabel dia={dia} />
          </Box>
        </TableCell>

        {/* Edit toggle */}
        <TableCell sx={{ width: 40, px: 0.5 }}>
          {!cellReadOnly && (
            <Tooltip title={expanded ? 'Cerrar' : 'Editar día'}>
              <IconButton
                size="small"
                onClick={() => setExpanded((v) => !v)}
                color={expanded ? 'primary' : 'default'}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      {/* Inline editor panel */}
      {!cellReadOnly && (
        <TableRow>
          <TableCell colSpan={5} sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}>
            <Collapse in={expanded} unmountOnExit>
              <InlineDiaEditor
                dia={dia}
                tarifaHora={tarifaHora}
                onSaved={handleSaved}
                onCancel={() => setExpanded(false)}
              />
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
