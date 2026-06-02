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
import TuneIcon from '@mui/icons-material/Tune';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';
import { MarcacionesEditor } from './MarcacionesEditor';
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
      return <Chip label="Con ajuste" size="small" color="warning" />;
    case 'CON_AJUSTE_Y_DESCUENTO':
      return <Chip label="H. + ajuste" size="small" color="warning" />;
    default:
      return <Chip label="Sin rev." size="small" variant="outlined" />;
  }
}

function ajusteChip(tipo: string | null, valor: number | null, descripcion: string | null) {
  if (!tipo || valor === null) return null;
  const isDescuento = tipo === 'DESCUENTO';
  const label = isDescuento
    ? `−${valor.toFixed(2)} Bs.`
    : tipo === 'BONO_HORAS_EXTRAS'
    ? `+${valor.toFixed(2)} Bs. HE`
    : `+${valor.toFixed(2)} Bs.`;
  return (
    <Tooltip title={descripcion ?? tipo}>
      <Chip
        label={label}
        size="small"
        color={isDescuento ? 'warning' : 'success'}
        sx={{ mt: 0.25, fontWeight: 600 }}
      />
    </Tooltip>
  );
}

export function PlanillaDiaRow({ dia, isReadOnly, tarifaHora, onDiaUpdate }: Props) {
  const [ajusteExpanded, setAjusteExpanded] = useState(false);

  const displayHoras = dia.horasAjustadasSupervisor ?? dia.horasParejadas ?? dia.horasCalculadas;
  const isAjustado = dia.horasAjustadasSupervisor !== null && dia.horasAjustadasSupervisor !== undefined;
  const cellReadOnly = isReadOnly || dia.estadoDia === 'APROBADO';

  const handleSaved = (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => {
    onDiaUpdate(updatedDia, updatedTotales);
    setAjusteExpanded(false);
  };

  return (
    <>
      <TableRow sx={{ '& > td': { borderBottom: ajusteExpanded ? 'none' : undefined } }}>
        {/* Fecha */}
        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500, width: 90, verticalAlign: 'top', pt: 1.25 }}>
          {formatFecha(dia.fecha)}
        </TableCell>

        {/* Marcaciones — always editable pairs */}
        <TableCell sx={{ verticalAlign: 'top', pt: 1 }}>
          <MarcacionesEditor dia={dia} isReadOnly={cellReadOnly} onSaved={onDiaUpdate} />
        </TableCell>

        {/* Horas efectivas */}
        <TableCell sx={{ width: 110, verticalAlign: 'top', pt: 1.25 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{displayHoras.toFixed(2)} h</Typography>
          {isAjustado && dia.marcacionesManuales == null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
              <Chip label="Ajust." size="small" color="info" />
              <Typography variant="caption" color="text.secondary">
                orig: {(dia.horasParejadas ?? dia.horasCalculadas).toFixed(2)}
              </Typography>
            </Box>
          )}
          {ajusteChip(dia.ajusteTipo, dia.ajusteValor ?? null, dia.ajusteDescripcion ?? null)}
        </TableCell>

        {/* Estado */}
        <TableCell sx={{ width: 110, verticalAlign: 'top', pt: 1.25 }}>
          {estadoChip(dia.estadoDia)}
        </TableCell>

        {/* Ajuste toggle (tipo de ajuste / motivo) */}
        <TableCell sx={{ width: 40, px: 0.5, verticalAlign: 'top', pt: 0.75 }}>
          {!cellReadOnly && (
            <Tooltip title={ajusteExpanded ? 'Cerrar ajuste' : 'Tipo de ajuste'}>
              <IconButton
                size="small"
                onClick={() => setAjusteExpanded((v) => !v)}
                color={ajusteExpanded ? 'primary' : (dia.ajusteTipo === 'DESCUENTO' ? 'warning' : dia.ajusteTipo ? 'success' : 'default')}
              >
                <TuneIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      {/* Ajuste panel (tipo + motivo) */}
      {!cellReadOnly && (
        <TableRow>
          <TableCell colSpan={5} sx={{ py: 0, borderBottom: ajusteExpanded ? undefined : 'none' }}>
            <Collapse in={ajusteExpanded} unmountOnExit>
              <InlineDiaEditor
                dia={dia}
                tarifaHora={tarifaHora}
                onSaved={handleSaved}
                onCancel={() => setAjusteExpanded(false)}
              />
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
