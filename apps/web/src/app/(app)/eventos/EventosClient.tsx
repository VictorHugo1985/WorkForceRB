'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Alert,
  Typography,
  SelectChangeEvent,
} from '@mui/material';

interface Dispositivo {
  id: string;
  nombre: string;
}

interface Evento {
  id: string;
  checktime: string;
  tipo_evento: 'ENTRADA' | 'SALIDA' | 'DESCONOCIDO';
  device_name: string;
  employee_workno: string;
  display_nombre: string;
  estado_resolucion: 'RESUELTO' | 'SIN_RESOLVER' | 'DISPOSITIVO_DESCONOCIDO';
}

interface ApiResult {
  eventos: Evento[];
  total: number;
  total_pages: number;
}

interface FiltrosState {
  fecha_desde: string;
  fecha_hasta: string;
  colaborador: string;
  tipo_evento: '' | 'ENTRADA' | 'SALIDA' | 'DESCONOCIDO';
  dispositivo: string;
  estado: '' | 'RESUELTO' | 'SIN_RESOLVER' | 'DISPOSITIVO_DESCONOCIDO';
  page: number;
  page_size: 25 | 50 | 100;
}

const TIPO_COLORS: Record<string, 'success' | 'warning' | 'default'> = {
  ENTRADA: 'success',
  SALIDA: 'warning',
  DESCONOCIDO: 'default',
};

const TIPO_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  DESCONOCIDO: 'Desconocido',
};

const ESTADO_COLORS: Record<string, 'success' | 'warning' | 'error'> = {
  RESUELTO: 'success',
  SIN_RESOLVER: 'warning',
  DISPOSITIVO_DESCONOCIDO: 'error',
};

const ESTADO_LABELS: Record<string, string> = {
  RESUELTO: 'Resuelto',
  SIN_RESOLVER: 'Sin resolver',
  DISPOSITIVO_DESCONOCIDO: 'Dispositivo desconocido',
};

function todayGMTMinus4(): string {
  const now = new Date();
  const offset = -4 * 60;
  const local = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  return local.toISOString().slice(0, 10);
}

function formatChecktime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function EventosClient({ dispositivos }: { dispositivos: Dispositivo[] }) {
  const today = todayGMTMinus4();
  const [filtros, setFiltros] = useState<FiltrosState>({
    fecha_desde: today,
    fecha_hasta: today,
    colaborador: '',
    tipo_evento: '',
    dispositivo: '',
    estado: '',
    page: 1,
    page_size: 25,
  });
  const [pendingFiltros, setPendingFiltros] = useState<FiltrosState>({
    fecha_desde: today,
    fecha_hasta: today,
    colaborador: '',
    tipo_evento: '',
    dispositivo: '',
    estado: '',
    page: 1,
    page_size: 25,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('fecha_desde', filtros.fecha_desde);
    params.set('fecha_hasta', filtros.fecha_hasta);
    if (filtros.colaborador) params.set('colaborador', filtros.colaborador);
    if (filtros.tipo_evento) params.set('tipo_evento', filtros.tipo_evento);
    if (filtros.dispositivo) params.set('dispositivo', filtros.dispositivo);
    if (filtros.estado) params.set('estado', filtros.estado);
    params.set('page', String(filtros.page));
    params.set('page_size', String(filtros.page_size));

    setLoading(true);
    setError(null);

    fetch(`/api/eventos-biometricos?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((data: ApiResult) => setResult(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filtros]);

  function handleFiltrar() {
    setFiltros({ ...pendingFiltros, page: 1 });
  }

  function handlePageChange(_: unknown, newPage: number) {
    setFiltros((f) => ({ ...f, page: newPage + 1 }));
    setPendingFiltros((f) => ({ ...f, page: newPage + 1 }));
  }

  function handleRowsPerPageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newSize = Number(e.target.value) as 25 | 50 | 100;
    setFiltros((f) => ({ ...f, page_size: newSize, page: 1 }));
    setPendingFiltros((f) => ({ ...f, page_size: newSize, page: 1 }));
  }

  return (
    <>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        Eventos Biométricos
      </Typography>

      {/* Filtros */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'flex-end',
          mb: 2,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <TextField
          label="Desde"
          type="date"
          value={pendingFiltros.fecha_desde}
          onChange={(e) => setPendingFiltros((f) => ({ ...f, fecha_desde: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 150 }}
        />
        <TextField
          label="Hasta"
          type="date"
          value={pendingFiltros.fecha_hasta}
          onChange={(e) => setPendingFiltros((f) => ({ ...f, fecha_hasta: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 150 }}
        />
        <TextField
          label="Colaborador"
          value={pendingFiltros.colaborador}
          onChange={(e) => setPendingFiltros((f) => ({ ...f, colaborador: e.target.value }))}
          placeholder="Nombre, cédula o código"
          sx={{ width: 200 }}
        />
        <FormControl sx={{ width: 140 }}>
          <InputLabel>Tipo</InputLabel>
          <Select
            label="Tipo"
            value={pendingFiltros.tipo_evento}
            onChange={(e: SelectChangeEvent) =>
              setPendingFiltros((f) => ({
                ...f,
                tipo_evento: e.target.value as FiltrosState['tipo_evento'],
              }))
            }
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="ENTRADA">Entrada</MenuItem>
            <MenuItem value="SALIDA">Salida</MenuItem>
            <MenuItem value="DESCONOCIDO">Desconocido</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ width: 160 }} disabled={dispositivos.length === 0}>
          <InputLabel>Dispositivo</InputLabel>
          <Select
            label="Dispositivo"
            value={pendingFiltros.dispositivo}
            onChange={(e: SelectChangeEvent) =>
              setPendingFiltros((f) => ({ ...f, dispositivo: e.target.value }))
            }
          >
            <MenuItem value="">Todos</MenuItem>
            {dispositivos.map((d) => (
              <MenuItem key={d.id} value={d.nombre}>
                {d.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ width: 160 }}>
          <InputLabel>Estado</InputLabel>
          <Select
            label="Estado"
            value={pendingFiltros.estado}
            onChange={(e: SelectChangeEvent) =>
              setPendingFiltros((f) => ({
                ...f,
                estado: e.target.value as FiltrosState['estado'],
              }))
            }
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="RESUELTO">Resuelto</MenuItem>
            <MenuItem value="SIN_RESOLVER">Sin resolver</MenuItem>
            <MenuItem value="DISPOSITIVO_DESCONOCIDO">Disp. desconocido</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={handleFiltrar} disabled={loading}>
          Filtrar
        </Button>
      </Box>

      {/* Estados */}
      {loading && (
        <Typography variant="body2" color="text.secondary">
          Cargando...
        </Typography>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error al cargar los eventos: {error}
        </Alert>
      )}

      {!loading && !error && result && result.eventos.length === 0 && (
        <Alert severity="info">No se encontraron eventos con los filtros seleccionados.</Alert>
      )}

      {/* Tabla */}
      {!loading && !error && result && result.eventos.length > 0 && (
        <Paper variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha y Hora</TableCell>
                  <TableCell>Colaborador</TableCell>
                  <TableCell>Workno</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Dispositivo</TableCell>
                  <TableCell>Estado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.eventos.map((ev) => (
                  <TableRow key={ev.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatChecktime(ev.checktime)}
                    </TableCell>
                    <TableCell
                      sx={
                        ev.estado_resolucion !== 'RESUELTO'
                          ? { color: 'text.disabled', fontStyle: 'italic' }
                          : undefined
                      }
                    >
                      {ev.display_nombre || ev.employee_workno}
                    </TableCell>
                    <TableCell>{ev.employee_workno}</TableCell>
                    <TableCell>
                      <Chip
                        label={TIPO_LABELS[ev.tipo_evento] ?? ev.tipo_evento}
                        color={TIPO_COLORS[ev.tipo_evento] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell>{ev.device_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={ESTADO_LABELS[ev.estado_resolucion] ?? ev.estado_resolucion}
                        color={ESTADO_COLORS[ev.estado_resolucion] ?? 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={result.total}
            page={filtros.page - 1}
            onPageChange={handlePageChange}
            rowsPerPage={filtros.page_size}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[25, 50, 100]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            labelRowsPerPage="Por página:"
          />
        </Paper>
      )}
    </>
  );
}
