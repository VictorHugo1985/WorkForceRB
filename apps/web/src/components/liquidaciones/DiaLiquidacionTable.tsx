'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useLiquidacionStore, DiaLiquidacionData } from '@/stores/liquidacion.store';
import { DiaAjusteDialog } from './DiaAjusteDialog';

function formatFecha(iso: string) {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function estadoDiaChip(estado: string) {
  switch (estado) {
    case 'APROBADO':
      return <Chip label="Aprobado" size="small" color="success" />;
    case 'CON_AJUSTE_HORAS':
      return <Chip label="H. ajustadas" size="small" color="info" />;
    case 'CON_DESCUENTO':
      return <Chip label="Con descuento" size="small" color="warning" />;
    case 'CON_AJUSTE_Y_DESCUENTO':
      return <Chip label="Ajuste + Desc." size="small" color="warning" />;
    default:
      return <Chip label="Sin rev." size="small" />;
  }
}

function descuentoLabel(tipo: string | null, valor: number | null) {
  if (!tipo) return '—';
  if (tipo === 'TARIFA_DIA') return `Tarifa fija${valor != null ? `: ${valor} Bs./h` : ''}`;
  if (tipo === 'MONTO_FIJO') return `Monto fijo${valor != null ? `: ${valor} Bs.` : ''}`;
  return tipo;
}

export function DiaLiquidacionTable() {
  const liquidacion = useLiquidacionStore((s) => s.liquidacion);
  const [dialogDia, setDialogDia] = useState<DiaLiquidacionData | null>(null);

  if (!liquidacion) return null;

  const isAprobado = liquidacion.estado === 'APROBADO';

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Horas Calc.</TableCell>
            <TableCell>Horas Ajust.</TableCell>
            <TableCell>Atraso</TableCell>
            <TableCell>Descuento</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {liquidacion.dias.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center">
                Sin registros de asistencia esta semana
              </TableCell>
            </TableRow>
          ) : (
            liquidacion.dias.map((dia) => (
              <TableRow key={dia.id}>
                <TableCell>{formatFecha(dia.fecha)}</TableCell>
                <TableCell>{Number(dia.horasCalculadas).toFixed(2)}</TableCell>
                <TableCell>
                  {dia.horasAjustadasSupervisor != null
                    ? Number(dia.horasAjustadasSupervisor).toFixed(2)
                    : '—'}
                </TableCell>
                <TableCell>
                  {dia.atrasoDetectado ? (
                    <Chip label="Atraso" size="small" color="error" />
                  ) : null}
                </TableCell>
                <TableCell>
                  {descuentoLabel(dia.descuentoTipo, dia.descuentoValor)}
                </TableCell>
                <TableCell>{estadoDiaChip(dia.estadoDia)}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={isAprobado}
                    onClick={() => setDialogDia(dia)}
                  >
                    Ajustar
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {dialogDia && (
        <DiaAjusteDialog
          dia={dialogDia}
          open
          onClose={() => setDialogDia(null)}
        />
      )}
    </Box>
  );
}
