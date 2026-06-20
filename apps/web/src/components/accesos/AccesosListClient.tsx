'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export interface AccesoRow {
  id: string;
  creado_en: string;
  resultado: 'exitoso' | 'fallido';
  ip_origen: string | null;
  descripcion: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
}

interface UsuarioOption {
  id: string;
  label: string;
}

interface Props {
  initialAccesos: AccesoRow[];
  initialTotal: number;
  rowsPerPage?: number;
}

export function AccesosListClient({ initialAccesos, initialTotal, rowsPerPage = 50 }: Props) {
  const router = useRouter();

  const [accesos, setAccesos] = useState<AccesoRow[]>(initialAccesos);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const [usuarioFiltro, setUsuarioFiltro] = useState<UsuarioOption | null>(null);
  const [resultadoFiltro, setResultadoFiltro] = useState<'' | 'exitoso' | 'fallido'>('');
  const [desdeFiltro, setDesdeFiltro] = useState('');
  const [hastaFiltro, setHastaFiltro] = useState('');

  const [usuariosOptions, setUsuariosOptions] = useState<UsuarioOption[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  useEffect(() => {
    setLoadingUsuarios(true);
    fetch('/api/accesos/usuarios-con-accesos')
      .then((r) => r.json())
      .then((data) => {
        const opts: UsuarioOption[] = (data.usuarios ?? []).map(
          (u: { id: string; nombre: string; apellido: string; email: string }) => ({
            id: u.id,
            label: `${u.apellido}, ${u.nombre} (${u.email})`,
          }),
        );
        setUsuariosOptions(opts);
      })
      .catch(() => {})
      .finally(() => setLoadingUsuarios(false));
  }, []);

  const fetchAccesos = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(p + 1));
        params.set('limit', String(rowsPerPage));
        if (usuarioFiltro) params.set('usuario_id', usuarioFiltro.id);
        if (resultadoFiltro) params.set('resultado', resultadoFiltro);
        if (desdeFiltro) params.set('desde', desdeFiltro);
        if (hastaFiltro) params.set('hasta', hastaFiltro);

        const res = await fetch(`/api/accesos?${params}`);
        if (res.status === 401) {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          router.push('/login?reason=expired');
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setAccesos(data.accesos ?? []);
        setTotal(data.total ?? 0);
        setPage(p);
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [usuarioFiltro, resultadoFiltro, desdeFiltro, hastaFiltro, rowsPerPage, router],
  );

  const applyFilters = useCallback(() => {
    fetchAccesos(0);
  }, [fetchAccesos]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Filter bar */}
      <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
        <Autocomplete
          options={usuariosOptions}
          loading={loadingUsuarios}
          value={usuarioFiltro}
          onChange={(_, v) => setUsuarioFiltro(v)}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          sx={{ minWidth: 260 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Usuario"
              size="small"
            />
          )}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Resultado</InputLabel>
          <Select
            value={resultadoFiltro}
            label="Resultado"
            onChange={(e) => setResultadoFiltro(e.target.value as '' | 'exitoso' | 'fallido')}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="exitoso">Exitoso</MenuItem>
            <MenuItem value="fallido">Fallido</MenuItem>
          </Select>
        </FormControl>

        <TextField
          label="Desde"
          type="date"
          size="small"
          value={desdeFiltro}
          onChange={(e) => setDesdeFiltro(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 160 }}
        />

        <TextField
          label="Hasta"
          type="date"
          size="small"
          value={hastaFiltro}
          onChange={(e) => setHastaFiltro(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 160 }}
        />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <button
            onClick={applyFilters}
            style={{
              padding: '6px 16px',
              borderRadius: 4,
              border: 'none',
              background: '#1976d2',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Filtrar
          </button>
          <button
            onClick={() => {
              setUsuarioFiltro(null);
              setResultadoFiltro('');
              setDesdeFiltro('');
              setHastaFiltro('');
              setTimeout(() => fetchAccesos(0), 0);
            }}
            style={{
              padding: '6px 16px',
              borderRadius: 4,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Limpiar
          </button>
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Fecha / Hora</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Usuario</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Resultado</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>IP</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>Descripción</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : accesos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Sin registros de acceso
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              accesos.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(a.creado_en).toLocaleString('es-CR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {a.usuario_nombre ? (
                      <Box>
                        <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 500 }}>
                          {a.usuario_nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {a.usuario_email}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.disabled" sx={{ fontSize: 12 }}>
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={a.resultado === 'exitoso' ? 'Exitoso' : 'Fallido'}
                      size="small"
                      color={a.resultado === 'exitoso' ? 'success' : 'error'}
                      variant="outlined"
                      sx={{ fontSize: 11 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>
                    {a.ip_origen ?? '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, maxWidth: 300 }}>
                    <Typography variant="body2" sx={{ fontSize: 12 }} noWrap title={a.descripcion ?? ''}>
                      {a.descripcion ?? '—'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => fetchAccesos(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[rowsPerPage]}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </TableContainer>
    </Box>
  );
}
