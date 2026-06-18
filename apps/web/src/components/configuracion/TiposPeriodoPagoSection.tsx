'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import { useSnackbar } from '@/lib/SnackbarContext';

interface TipoPeriodoPago {
  codigo: string;
  nombre: string;
  activo: boolean;
}

export function TiposPeriodoPagoSection() {
  const { showSuccess, showError } = useSnackbar();
  const router = useRouter();
  const handleSessionExpired = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login?reason=expired');
  }, [router]);

  const [tipos, setTipos] = useState<TipoPeriodoPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingCodigo, setTogglingCodigo] = useState<string | null>(null);

  const fetchTipos = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion/tipos-periodo-pago');
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) { showError('Error al cargar tipos de período de pago.'); return; }
      const data = await res.json();
      setTipos(data.tiposPeriodoPago);
    } catch {
      showError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired, showError]);

  useEffect(() => { fetchTipos(); }, [fetchTipos]);

  const handleToggleActivo = async (tipo: TipoPeriodoPago) => {
    setTogglingCodigo(tipo.codigo);
    try {
      const res = await fetch(`/api/configuracion/tipos-periodo-pago/${tipo.codigo}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !tipo.activo }),
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showError(data.error ?? 'Error al cambiar estado.'); return; }
      setTipos((prev) =>
        prev.map((t) => (t.codigo === tipo.codigo ? data.tipoPeriodoPago : t)),
      );
      showSuccess(tipo.activo ? 'Tipo inactivado.' : 'Tipo activado.');
    } catch {
      showError('Error de conexión.');
    } finally {
      setTogglingCodigo(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6">Tipos de Período de Pago</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Activa o inactiva los períodos de pago disponibles para los colaboradores.
        </Typography>
      </Box>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nombre</TableCell>
            <TableCell>Código</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tipos.map((tipo) => (
            <TableRow key={tipo.codigo} hover>
              <TableCell>{tipo.nombre}</TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {tipo.codigo}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={tipo.activo ? 'Activo' : 'Inactivo'}
                  color={tipo.activo ? 'success' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell align="right">
                <Tooltip title={tipo.activo ? 'Inactivar' : 'Activar'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleActivo(tipo)}
                      disabled={togglingCodigo === tipo.codigo}
                    >
                      {tipo.activo ? (
                        <ToggleOnIcon fontSize="small" color="success" />
                      ) : (
                        <ToggleOffIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
