'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useLiquidacionStore } from '@/stores/liquidacion.store';

function bs(value: number) {
  return `${value.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`;
}

export function LiquidacionSummaryCard() {
  const liquidacion = useLiquidacionStore((s) => s.liquidacion);
  if (!liquidacion) return null;

  const rows = [
    { label: 'Horas ordinarias', value: `${Number(liquidacion.horasOrdinarias).toFixed(2)} h` },
    { label: 'Horas extra', value: `${Number(liquidacion.horasExtra).toFixed(2)} h` },
    { label: 'Valor horas ordinarias', value: bs(Number(liquidacion.valorHorasOrdinarias)) },
    { label: 'Valor horas extra', value: bs(Number(liquidacion.valorHorasExtra)) },
    { label: 'Total bonos', value: bs(Number(liquidacion.totalBonos)) },
    { label: 'Total descuentos', value: `−${bs(Number(liquidacion.totalDescuentos))}` },
  ];

  const calculadoEn = liquidacion.calculadoEn
    ? new Date(liquidacion.calculadoEn).toLocaleString('es-VE')
    : null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
            Resumen
          </Typography>
          {liquidacion.estado === 'APROBADO' ? (
            <Chip label="Aprobado" size="small" color="success" />
          ) : (
            <Chip label="Borrador" size="small" color="warning" />
          )}
        </Box>

        <Table size="small">
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell sx={{ borderBottom: 'none', py: 0.5 }}>{row.label}</TableCell>
                <TableCell align="right" sx={{ borderBottom: 'none', py: 0.5 }}>
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            Total a Pagar
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            {bs(Number(liquidacion.totalPago))}
          </Typography>
        </Box>

        {calculadoEn && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Calculado: {calculadoEn}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
