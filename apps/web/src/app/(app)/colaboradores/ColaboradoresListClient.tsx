'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { PageHeader } from '@/components/ui/PageHeader';

type TipoPago = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

const TIPO_PAGO_LABEL: Record<TipoPago, string> = {
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
};

interface ColaboradorRow {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  workno: string;
  telefono: string;
  activo: boolean;
  fijo: boolean;
  tarifa_hora: number | null;
  tipo_pago: TipoPago | null;
  area: { id: string; nombre: string } | null;
}

interface Props {
  colaboradores: ColaboradorRow[];
}

type TipoFiltro = 'todos' | 'fijo' | 'jornalero';

export function ColaboradoresListClient({ colaboradores }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');

  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return colaboradores.filter((c) => {
      if (!mostrarInactivos && !c.activo) return false;
      if (tipoFiltro === 'fijo' && !c.fijo) return false;
      if (tipoFiltro === 'jornalero' && c.fijo) return false;
      if (!q) return true;
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.apellido.toLowerCase().includes(q) ||
        c.cedula.toLowerCase().includes(q) ||
        c.workno.toLowerCase().includes(q) ||
        c.telefono.toLowerCase().includes(q)
      );
    });
  }, [colaboradores, busqueda, mostrarInactivos, tipoFiltro]);

  return (
    <Box>
      <PageHeader
        title="Colaboradores"
        action={
          <Button
            component={Link}
            href="/colaboradores/nuevo"
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
          >
            Nuevo colaborador
          </Button>
        }
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField
          placeholder="Buscar por nombre, apellido, workno o teléfono..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          size="small"
          sx={{ flexGrow: 1, maxWidth: 420 }}
        />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {(['todos', 'fijo', 'jornalero'] as TipoFiltro[]).map((t) => (
            <Chip
              key={t}
              label={t === 'todos' ? 'Todos' : t === 'fijo' ? 'Fijo' : 'Jornalero'}
              size="small"
              variant={tipoFiltro === t ? 'filled' : 'outlined'}
              color={tipoFiltro === t ? (t === 'fijo' ? 'warning' : 'primary') : 'default'}
              onClick={() => setTipoFiltro(t)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Mostrar inactivos</Typography>}
        />
      </Box>

      {filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
          No se encontraron colaboradores con ese criterio.
        </Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre completo</TableCell>
                <TableCell>Workno</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Área</TableCell>
                <TableCell align="right">Tarifa/h</TableCell>
                <TableCell>Tipo de pago</TableCell>
                <TableCell>Tipo colaborador</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/colaboradores/${c.id}`)}
                >
                  <TableCell sx={{ fontWeight: 500 }}>
                    {c.apellido}, {c.nombre}
                  </TableCell>
                  <TableCell>{c.workno || '—'}</TableCell>
                  <TableCell>{c.telefono || '—'}</TableCell>
                  <TableCell>{c.area?.nombre ?? '—'}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {c.tarifa_hora !== null ? `${c.tarifa_hora.toLocaleString('es-VE')} Bs.` : '—'}
                  </TableCell>
                  <TableCell>
                    {c.tipo_pago ? (
                      <Chip label={TIPO_PAGO_LABEL[c.tipo_pago]} size="small" variant="outlined" />
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={c.fijo ? 'Fijo' : 'Jornalero'}
                      color={c.fijo ? 'warning' : 'default'}
                      variant={c.fijo ? 'filled' : 'outlined'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={c.activo ? 'Activo' : 'Inactivo'}
                      color={c.activo ? 'success' : 'default'}
                      size="small"
                    />
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
