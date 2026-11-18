'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AddTaskIcon from '@mui/icons-material/AddTask';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from '@/lib/SnackbarContext';
import type {
  ColaboradorEvaluacionRow,
  ColaboradoresEvaluacionResponse,
} from '@/lib/evaluaciones-types';
import { NuevaEvaluacionDialog } from './NuevaEvaluacionDialog';

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export interface EvaluacionesListClientProps {
  initialData: ColaboradoresEvaluacionResponse;
  rowsPerPage: number;
}

export function EvaluacionesListClient({ initialData, rowsPerPage }: EvaluacionesListClientProps) {
  const { showError } = useSnackbar();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [data, setData] = useState(initialData);
  const [q, setQ] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [evaluar, setEvaluar] = useState<ColaboradorEvaluacionRow | null>(null);
  const firstRender = useRef(true);

  const fetchData = useCallback(
    async (opts: { q: string; incluirInactivos: boolean; page: number }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(opts.page + 1),
          limit: String(rowsPerPage),
          incluir_inactivos: String(opts.incluirInactivos),
        });
        if (opts.q.trim()) params.set('q', opts.q.trim());
        const res = await fetch(`/api/evaluaciones/colaboradores?${params}`);
        if (res.status === 401) {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          router.push('/login?reason=expired');
          return;
        }
        if (!res.ok) { showError('Error al cargar los colaboradores.'); return; }
        setData(await res.json());
      } catch {
        showError('Error de conexión.');
      } finally {
        setLoading(false);
      }
    },
    [rowsPerPage, router, showError],
  );

  // Búsqueda con debounce; filtro y página recargan inmediatamente.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(() => fetchData({ q, incluirInactivos, page }), 300);
    return () => clearTimeout(t);
  }, [q, incluirInactivos, page, fetchData]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <TextField
          size="small"
          placeholder="Buscar por nombre o cédula"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          sx={{ flex: 1, maxWidth: { sm: 360 } }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={incluirInactivos}
              onChange={(e) => { setIncluirInactivos(e.target.checked); setPage(0); }}
            />
          }
          label="Incluir inactivos"
        />
      </Box>

      <Paper variant="outlined">
        {loading && <LinearProgress />}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Colaborador</TableCell>
                {!isMobile && <TableCell>Cédula</TableCell>}
                <TableCell align="right">Promedio</TableCell>
                {!isMobile && <TableCell>Última evaluación</TableCell>}
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.colaboradores.map((c) => (
                <TableRow key={c.id} hover sx={{ opacity: c.activo ? 1 : 0.65 }}>
                  <TableCell>
                    {c.apellido}, {c.nombre}
                    {!c.activo && <Chip label="Inactivo" size="small" sx={{ ml: 1 }} />}
                  </TableCell>
                  {!isMobile && <TableCell>{c.cedula}</TableCell>}
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {c.puntaje_promedio ?? '—'}
                  </TableCell>
                  {!isMobile && (
                    <TableCell sx={{ color: c.ultima_evaluacion ? 'inherit' : 'text.secondary' }}>
                      {c.ultima_evaluacion ? formatFecha(c.ultima_evaluacion) : 'Sin evaluaciones'}
                    </TableCell>
                  )}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {isMobile ? (
                      <>
                        <Tooltip title="Ver histórico">
                          <IconButton size="small" component={Link} href={`/evaluaciones/${c.id}`}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {c.activo && (
                          <Tooltip title="Nueva evaluación">
                            <IconButton size="small" color="primary" onClick={() => setEvaluar(c)}>
                              <AddTaskIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    ) : (
                      <>
                        <Button size="small" component={Link} href={`/evaluaciones/${c.id}`}>
                          Ver histórico
                        </Button>
                        {c.activo && (
                          <Button size="small" variant="contained" sx={{ ml: 1 }} onClick={() => setEvaluar(c)}>
                            Nueva evaluación
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.colaboradores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No se encontraron colaboradores.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data.total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[rowsPerPage]}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </Paper>

      <NuevaEvaluacionDialog
        open={evaluar !== null}
        colaborador={evaluar}
        onClose={() => setEvaluar(null)}
        onSaved={() => fetchData({ q, incluirInactivos, page })}
      />
    </Box>
  );
}
