'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SearchIcon from '@mui/icons-material/Search';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSnackbar } from '@/lib/SnackbarContext';
import { CrearUsuarioDialog } from './CrearUsuarioDialog';
import { EditarUsuarioDialog } from './EditarUsuarioDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

export interface UsuarioRow {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  activo: boolean;
  roles: string[];
  colaborador_id: string | null;
  colaborador_nombre: string | null;
  creado_en: string;
}

interface Props {
  usuarios: UsuarioRow[];
  isAdmin: boolean;
  currentUserId: string;
}

const ROL_COLOR: Record<string, 'primary' | 'secondary' | 'warning' | 'default'> = {
  ADMINISTRADOR: 'primary',
  SUPERVISOR: 'secondary',
  CAJERO: 'warning',
  COLABORADOR: 'default',
};

export function UsuariosListClient({ usuarios: initial, isAdmin, currentUserId }: Props) {
  const { showSuccess, showError } = useSnackbar();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>(initial);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UsuarioRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UsuarioRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) =>
        `${u.nombre} ${u.apellido}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [usuarios, search]);

  const activeAdmins = usuarios.filter((u) => u.activo && u.roles.includes('ADMINISTRADOR'));

  const handleToggleEstado = async (u: UsuarioRow) => {
    if (!u.activo && activeAdmins.length === 0) return;
    if (u.activo && u.roles.includes('ADMINISTRADOR') && activeAdmins.length <= 1) {
      showError('No se puede desactivar el último administrador activo.');
      return;
    }
    setTogglingId(u.id);
    try {
      const res = await fetch(`/api/usuarios/${u.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !u.activo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showError(data.message ?? 'Error al cambiar estado.');
        return;
      }
      setUsuarios((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, activo: !u.activo } : x)),
      );
      showSuccess(u.activo ? 'Cuenta desactivada.' : 'Cuenta activada.');
    } catch {
      showError('Error de conexión.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreado = (nuevo: UsuarioRow) => {
    setUsuarios((prev) => [...prev, nuevo]);
    setCreateOpen(false);
  };

  const handleEditado = (actualizado: UsuarioRow) => {
    setUsuarios((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)));
    setEditTarget(null);
  };

  return (
    <Box>
      <PageHeader
        title="Usuarios del Sistema"
        action={
          isAdmin ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              size="small"
            >
              Nuevo usuario
            </Button>
          ) : undefined
        }
      />

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por nombre o correo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 320 }}
        />
      </Box>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Correo</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Creado</TableCell>
              {isAdmin && <TableCell align="right">Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                    Sin resultados
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.apellido}, {u.nombre}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {u.roles.map((r) => (
                      <Chip
                        key={r}
                        label={r}
                        size="small"
                        color={ROL_COLOR[r] ?? 'default'}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={u.activo ? 'Activo' : 'Inactivo'}
                    size="small"
                    color={u.activo ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  {new Date(u.creado_en).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </TableCell>
                {isAdmin && (
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => setEditTarget(u)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Resetear contraseña">
                      <IconButton
                        size="small"
                        onClick={() => setResetTarget(u)}
                        disabled={!u.activo}
                      >
                        <VpnKeyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={
                        u.activo && u.roles.includes('ADMINISTRADOR') && activeAdmins.length <= 1
                          ? 'Último administrador activo'
                          : u.activo
                          ? 'Desactivar'
                          : 'Activar'
                      }
                    >
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleEstado(u)}
                          disabled={
                            togglingId === u.id ||
                            (u.activo &&
                              u.roles.includes('ADMINISTRADOR') &&
                              activeAdmins.length <= 1)
                          }
                        >
                          {u.activo ? (
                            <LockIcon fontSize="small" />
                          ) : (
                            <LockOpenIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {isAdmin && (
        <>
          <CrearUsuarioDialog
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreado={handleCreado}
          />
          {editTarget && (
            <EditarUsuarioDialog
              open
              usuario={editTarget}
              onClose={() => setEditTarget(null)}
              onEditado={handleEditado}
            />
          )}
          {resetTarget && (
            <ResetPasswordDialog
              open
              usuario={resetTarget}
              onClose={() => setResetTarget(null)}
            />
          )}
        </>
      )}
    </Box>
  );
}
