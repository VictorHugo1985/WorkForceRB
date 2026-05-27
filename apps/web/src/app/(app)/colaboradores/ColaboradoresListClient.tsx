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

interface ColaboradorRow {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  activo: boolean;
  area: { id: string; nombre: string } | null;
}

interface Props {
  colaboradores: ColaboradorRow[];
}

export function ColaboradoresListClient({ colaboradores }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);

  const filtered = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return colaboradores.filter((c) => {
      if (!mostrarInactivos && !c.activo) return false;
      if (!q) return true;
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.apellido.toLowerCase().includes(q) ||
        c.cedula.toLowerCase().includes(q)
      );
    });
  }, [colaboradores, busqueda, mostrarInactivos]);

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
          placeholder="Buscar por nombre, apellido o cédula..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          size="small"
          sx={{ flexGrow: 1, maxWidth: 420 }}
        />
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
                <TableCell>Cédula</TableCell>
                <TableCell>Área</TableCell>
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
                  <TableCell>{c.cedula}</TableCell>
                  <TableCell>{c.area?.nombre ?? '—'}</TableCell>
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
