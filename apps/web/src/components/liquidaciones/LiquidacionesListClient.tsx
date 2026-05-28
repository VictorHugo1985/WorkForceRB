'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { PageHeader } from '@/components/ui/PageHeader';

interface SemanaLaboral {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
}

interface LiquidacionResumen {
  colaboradorId: string;
  colaboradorNombre: string;
  colaboradorApellido: string;
  area: string | null;
  liquidacionId: string | null;
  estado: string | null;
  totalPago: number | null;
}

interface Props {
  semanaActiva: SemanaLaboral | null;
  semanas: SemanaLaboral[];
  liquidaciones: LiquidacionResumen[];
}

function estadoChip(estado: string | null) {
  if (!estado) return <Chip label="Sin liquidación" size="small" variant="outlined" />;
  if (estado === 'APROBADO') return <Chip label="Aprobado" size="small" color="success" />;
  if (estado === 'BORRADOR') return <Chip label="Borrador" size="small" color="warning" />;
  return <Chip label={estado} size="small" />;
}

function formatSemana(s: SemanaLaboral) {
  const ini = s.fecha_inicio.slice(0, 10);
  const fin = s.fecha_fin.slice(0, 10);
  return `${ini} – ${fin}`;
}

export function LiquidacionesListClient({ semanaActiva, semanas, liquidaciones }: Props) {
  const router = useRouter();

  const handleSemanaChange = (e: SelectChangeEvent) => {
    router.push(`/liquidaciones?semana_id=${e.target.value}`);
  };

  return (
    <Box>
      <PageHeader title="Liquidaciones Semanales" />

      <Box sx={{ mb: 3, maxWidth: 400 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Semana</InputLabel>
          <Select
            label="Semana"
            value={semanaActiva?.id ?? ''}
            onChange={handleSemanaChange}
          >
            {semanas.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {formatSemana(s)}
                {s.estado === 'ABIERTA' && (
                  <Chip label="Activa" size="small" color="info" sx={{ ml: 1 }} />
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {liquidaciones.length === 0 ? (
        <Typography color="text.secondary">No hay colaboradores en esta semana.</Typography>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Colaborador</TableCell>
                <TableCell>Área</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Total a Pagar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {liquidaciones.map((row) => (
                <TableRow
                  key={row.colaboradorId}
                  hover
                  sx={{ cursor: semanaActiva ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (semanaActiva) {
                      router.push(`/liquidaciones/${semanaActiva.id}/${row.colaboradorId}`);
                    }
                  }}
                >
                  <TableCell>
                    {row.colaboradorApellido}, {row.colaboradorNombre}
                  </TableCell>
                  <TableCell>{row.area ?? '—'}</TableCell>
                  <TableCell>{estadoChip(row.estado)}</TableCell>
                  <TableCell align="right">
                    {row.totalPago !== null
                      ? `${row.totalPago.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
