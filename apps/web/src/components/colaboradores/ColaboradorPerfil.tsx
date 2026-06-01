'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useSnackbar } from '@/lib/SnackbarContext';

interface CodigoBiometrico {
  id: string;
  workno: string;
  activo: boolean;
  dispositivo: { id: string; nombre: string; numero_serie: string };
}

interface PlantillaHorario {
  id: string;
  nombre: string;
  dias_laborables: string[];
  hora_entrada_esperada: string;
}

interface PerfilData {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  activo: boolean;
  creado_en: string;
  supervisor: { id: string; nombre: string; apellido: string } | null;
  tarifa_hora: number | null;
  plantilla_horario: PlantillaHorario | null;
  codigos_biometricos: CodigoBiometrico[];
}

interface ColaboradorPerfilProps {
  perfil: PerfilData;
}

const EditSchema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  apellido: z.string().min(1, 'Requerido').max(100),
  cedula: z.string().min(1, 'Requerido'),
  telefono: z.string().max(30).optional().or(z.literal('')),
  fecha_nacimiento: z.string().optional().or(z.literal('')),
  supervisor_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
});
type EditFormValues = z.infer<typeof EditSchema>;

const TarifaSchema = z.object({
  valor: z.number().positive('Debe ser mayor a 0'),
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function ColaboradorPerfil({ perfil }: ColaboradorPerfilProps) {
  const { showSuccess, showError } = useSnackbar();

  const [data, setData] = useState({
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    cedula: perfil.cedula,
    telefono: perfil.telefono,
    fecha_nacimiento: perfil.fecha_nacimiento,
    activo: perfil.activo,
    supervisor: perfil.supervisor,
  });
  const [tarifaHora, setTarifaHora] = useState<number | null>(perfil.tarifa_hora);
  const [plantilla, setPlantilla] = useState<PlantillaHorario | null>(perfil.plantilla_horario);
  const [localCodigos, setLocalCodigos] = useState<CodigoBiometrico[]>(perfil.codigos_biometricos);
  const [worknos, setWorknos] = useState<Record<string, string>>(
    Object.fromEntries(perfil.codigos_biometricos.map((c) => [c.id, c.workno])),
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [supervisores, setSupervisores] = useState<{ id: string; nombre: string; apellido: string }[]>([]);

  // Tarifa edit dialog
  const [tarifaDialogOpen, setTarifaDialogOpen] = useState(false);
  const [tarifaSubmitting, setTarifaSubmitting] = useState(false);
  const [tarifaInput, setTarifaInput] = useState('');
  const [tarifaError, setTarifaError] = useState<string | null>(null);

  // Plantilla selector dialog
  const [plantillaDialogOpen, setPlantillaDialogOpen] = useState(false);
  const [plantillaLoading, setPlantillaLoading] = useState(false);
  const [plantillasDisponibles, setPlantillasDisponibles] = useState<PlantillaHorario[]>([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string>('');

  const [bajaDialogOpen, setBajaDialogOpen] = useState(false);
  const [bajaLoading, setBajaLoading] = useState(false);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<EditFormValues>({
    resolver: zodResolver(EditSchema),
    defaultValues: {
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      telefono: data.telefono ?? '',
      fecha_nacimiento: data.fecha_nacimiento ?? '',
      supervisor_id: data.supervisor?.id ?? '',
    },
  });

  function handleEditClick() {
    fetch('/api/usuarios/supervisores').then((r) => r.json()).then((d) => setSupervisores(d.supervisores ?? []));
    reset({
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      telefono: data.telefono ?? '',
      fecha_nacimiento: data.fecha_nacimiento ?? '',
      supervisor_id: data.supervisor?.id ?? '',
    });
    setWorknos(Object.fromEntries(localCodigos.map((c) => [c.id, c.workno])));
    setEditError(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditError(null);
  }

  async function onEditSubmit(values: EditFormValues) {
    setEditError(null);
    const supervisor_id = values.supervisor_id || null;
    const codigos = localCodigos.map((c) => ({ id: c.id, workno: worknos[c.id] ?? c.workno }));
    try {
      const res = await fetch(`/api/colaboradores/${perfil.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, supervisor_id, codigos }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.message ?? json?.error ?? `Error ${res.status}`;
        setEditError(msg);
        showError(`No se pudo guardar: ${msg}`);
        return;
      }
      const supObj = supervisores.find((s) => s.id === supervisor_id) ?? null;
      setData((prev) => ({
        ...prev,
        nombre: values.nombre,
        apellido: values.apellido,
        cedula: values.cedula,
        telefono: values.telefono || null,
        fecha_nacimiento: values.fecha_nacimiento || null,
        supervisor: supObj ? { id: supObj.id, nombre: supObj.nombre, apellido: supObj.apellido } : null,
      }));
      setLocalCodigos((prev) => prev.map((c) => ({ ...c, workno: worknos[c.id] ?? c.workno })));
      setIsEditing(false);
      showSuccess('Datos actualizados correctamente.');
    } catch {
      const msg = 'Error de red. Intente de nuevo.';
      setEditError(msg);
      showError(msg);
    }
  }

  function openTarifaDialog() {
    setTarifaInput(tarifaHora !== null ? String(tarifaHora) : '');
    setTarifaError(null);
    setTarifaDialogOpen(true);
  }

  async function handleTarifaSave() {
    const parsed = TarifaSchema.safeParse({ valor: Number(tarifaInput) });
    if (!parsed.success) {
      setTarifaError(parsed.error.issues[0]?.message ?? 'Valor inválido');
      return;
    }
    setTarifaSubmitting(true);
    try {
      const res = await fetch(`/api/colaboradores/${perfil.id}/tarifa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: parsed.data.valor }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setTarifaError(json?.message ?? 'Error al guardar');
        return;
      }
      setTarifaHora(parsed.data.valor);
      setTarifaDialogOpen(false);
      showSuccess('Tarifa actualizada correctamente.');
    } catch {
      setTarifaError('Error de red. Intente de nuevo.');
    } finally {
      setTarifaSubmitting(false);
    }
  }

  async function openPlantillaDialog() {
    setPlantillaLoading(true);
    setPlantillaDialogOpen(true);
    setPlantillaSeleccionada(plantilla?.id ?? '');
    try {
      const res = await fetch('/api/plantillas-horario');
      const json = await res.json();
      setPlantillasDisponibles(json.plantillas ?? []);
    } catch {
      showError('Error cargando plantillas.');
    } finally {
      setPlantillaLoading(false);
    }
  }

  async function handlePlantillaSave() {
    try {
      const res = await fetch(`/api/colaboradores/${perfil.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: data.nombre,
          apellido: data.apellido,
          cedula: data.cedula,
          supervisor_id: data.supervisor?.id ?? null,
          plantilla_horario_id: plantillaSeleccionada || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showError(json?.message ?? 'Error al guardar');
        return;
      }
      const found = plantillasDisponibles.find((p) => p.id === plantillaSeleccionada) ?? null;
      setPlantilla(found);
      setPlantillaDialogOpen(false);
      showSuccess('Plantilla de horario actualizada.');
    } catch {
      showError('Error de red. Intente de nuevo.');
    }
  }

  async function handleBajaConfirm() {
    setBajaLoading(true);
    try {
      const res = await fetch(`/api/colaboradores/${perfil.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: false }),
      });
      if (res.ok) {
        setData((prev) => ({ ...prev, activo: false }));
        setBajaDialogOpen(false);
        showSuccess('Colaborador dado de baja.');
      } else {
        const json = await res.json().catch(() => ({}));
        showError(json?.message ?? 'No se pudo dar de baja. Intente de nuevo.');
      }
    } catch {
      showError('Error de red. Intente de nuevo.');
    } finally {
      setBajaLoading(false);
    }
  }

  async function handleReactivar() {
    try {
      const res = await fetch(`/api/colaboradores/${perfil.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: true }),
      });
      if (res.ok) {
        setData((prev) => ({ ...prev, activo: true }));
        showSuccess('Colaborador reactivado.');
      } else {
        const json = await res.json().catch(() => ({}));
        showError(json?.message ?? 'No se pudo reactivar. Intente de nuevo.');
      }
    } catch {
      showError('Error de red. Intente de nuevo.');
    }
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      {!data.activo && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Este colaborador está inactivo y no resolverá nuevos eventos biométricos.
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {data.nombre} {data.apellido}
        </Typography>
        <Chip
          label={data.activo ? 'Activo' : 'Inactivo'}
          color={data.activo ? 'success' : 'default'}
          size="small"
        />
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {!isEditing && (
            <>
              <Button size="small" variant="outlined" onClick={handleEditClick}>
                Editar
              </Button>
              {data.activo ? (
                <Button size="small" variant="outlined" color="error" onClick={() => setBajaDialogOpen(true)}>
                  Dar de baja
                </Button>
              ) : (
                <Button size="small" variant="outlined" color="success" onClick={handleReactivar}>
                  Reactivar
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* ── Datos personales ── */}
      <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 2, mb: 1 }}>Datos personales</Typography>
      <Divider sx={{ mb: 1 }} />

      {isEditing ? (
        <Box
          component="form"
          onSubmit={handleSubmit(onEditSubmit)}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
        >
          {editError && <Alert severity="error">{editError}</Alert>}

          <TextField
            label="Nombre"
            size="small"
            {...register('nombre')}
            error={!!errors.nombre}
            helperText={errors.nombre?.message}
            required
          />
          <TextField
            label="Apellido"
            size="small"
            {...register('apellido')}
            error={!!errors.apellido}
            helperText={errors.apellido?.message}
            required
          />
          <TextField
            label="Cédula"
            size="small"
            {...register('cedula')}
            error={!!errors.cedula}
            helperText={errors.cedula?.message}
            required
          />
          <TextField
            label="Teléfono"
            size="small"
            {...register('telefono')}
            error={!!errors.telefono}
            helperText={errors.telefono?.message}
          />
          <TextField
            label="Fecha de nacimiento"
            type="date"
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            {...register('fecha_nacimiento')}
            error={!!errors.fecha_nacimiento}
            helperText={errors.fecha_nacimiento?.message}
          />
          <Controller
            name="supervisor_id"
            control={control}
            render={({ field }) => (
              <FormControl size="small">
                <InputLabel>Supervisor (opcional)</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Supervisor (opcional)">
                  <MenuItem value=""><em>Sin supervisor</em></MenuItem>
                  {supervisores.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.nombre} {s.apellido}</MenuItem>
                  ))}
                </Select>
                {errors.supervisor_id && <FormHelperText error>{errors.supervisor_id.message}</FormHelperText>}
              </FormControl>
            )}
          />

          {localCodigos.length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mt: 1 }}>
                Códigos biométricos
              </Typography>
              {localCodigos.map((c) => (
                <TextField
                  key={c.id}
                  label={`Workno — ${c.dispositivo.nombre}`}
                  size="small"
                  value={worknos[c.id] ?? ''}
                  onChange={(e) => setWorknos((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  helperText={`Dispositivo: ${c.dispositivo.nombre} (S/N: ${c.dispositivo.numero_serie})`}
                />
              ))}
            </>
          )}

          <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
            <Button
              type="submit"
              variant="contained"
              size="small"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={14} /> : undefined}
            >
              Guardar
            </Button>
            <Button size="small" variant="outlined" onClick={handleCancelEdit} disabled={isSubmitting}>
              Cancelar
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          <Row label="Cédula" value={data.cedula} />
          <Row label="Teléfono" value={data.telefono ?? '—'} />
          <Row
            label="Fecha de nacimiento"
            value={data.fecha_nacimiento ? formatDate(data.fecha_nacimiento) : '—'}
          />
          <Row
            label="Supervisor"
            value={data.supervisor ? `${data.supervisor.nombre} ${data.supervisor.apellido}` : 'Sin supervisor'}
          />
          <Row label="Registrado el" value={new Date(perfil.creado_en).toLocaleDateString('es-VE')} />
        </>
      )}

      {/* ── Tarifa salarial ── */}
      {!isEditing && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Tarifa salarial</Typography>
            <Button size="small" onClick={openTarifaDialog} sx={{ ml: 'auto' }}>
              Editar tarifa
            </Button>
          </Box>
          <Divider sx={{ mb: 1 }} />
          {tarifaHora !== null ? (
            <Row label="Tarifa por hora" value={`${tarifaHora.toLocaleString('es-VE')} Bs./h`} />
          ) : (
            <Alert severity="warning" sx={{ mt: 1 }}>Sin tarifa configurada — el colaborador no generará valor en las liquidaciones hasta que se asigne una tarifa.</Alert>
          )}

          {/* ── Plantilla de horario ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>Plantilla de horario</Typography>
            <Button size="small" onClick={openPlantillaDialog} sx={{ ml: 'auto' }}>
              {plantilla ? 'Cambiar' : 'Asignar'}
            </Button>
          </Box>
          <Divider sx={{ mb: 1 }} />
          {plantilla ? (
            <>
              <Row label="Plantilla" value={plantilla.nombre} />
              <Row label="Días laborables" value={plantilla.dias_laborables.join(', ')} />
              <Row label="Hora entrada esperada" value={plantilla.hora_entrada_esperada} />
            </>
          ) : (
            <Alert severity="info" sx={{ mt: 1 }}>Sin plantilla asignada — no se detectarán atrasos en las liquidaciones.</Alert>
          )}

          {/* ── Códigos biométricos ── */}
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 3, mb: 1 }}>Códigos biométricos</Typography>
          <Divider sx={{ mb: 1 }} />
          {localCodigos.length === 0 ? (
            <Alert severity="warning">Sin código biométrico asignado. El colaborador no puede resolver marcajes.</Alert>
          ) : (
            localCodigos.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {c.dispositivo.nombre} (S/N: {c.dispositivo.numero_serie})
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>Workno: {c.workno}</Typography>
              </Box>
            ))
          )}
        </>
      )}

      {/* ── Tarifa edit dialog ── */}
      <Dialog open={tarifaDialogOpen} onClose={() => setTarifaDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar tarifa por hora</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {tarifaError && <Alert severity="error" sx={{ mb: 2 }}>{tarifaError}</Alert>}
          <TextField
            label="Tarifa (Bs./h)"
            type="number"
            size="small"
            fullWidth
            value={tarifaInput}
            onChange={(e) => setTarifaInput(e.target.value)}
            inputProps={{ min: 0.01, step: 0.01 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarifaDialogOpen(false)} disabled={tarifaSubmitting}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleTarifaSave}
            disabled={tarifaSubmitting}
            startIcon={tarifaSubmitting ? <CircularProgress size={14} /> : undefined}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Plantilla selector dialog ── */}
      <Dialog open={plantillaDialogOpen} onClose={() => setPlantillaDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Asignar plantilla de horario</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {plantillaLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <FormControl size="small" fullWidth>
              <InputLabel>Plantilla</InputLabel>
              <Select
                value={plantillaSeleccionada}
                onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                label="Plantilla"
              >
                <MenuItem value=""><em>Sin plantilla</em></MenuItem>
                {plantillasDisponibles.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlantillaDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handlePlantillaSave} disabled={plantillaLoading}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Baja dialog ── */}
      <Dialog open={bajaDialogOpen} onClose={() => setBajaDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Dar de baja al colaborador</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Está seguro de que desea dar de baja a <strong>{data.nombre} {data.apellido}</strong>?
            El colaborador pasará a estado inactivo y dejará de aparecer en las listas por defecto.
            Sus datos históricos se conservarán íntegramente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBajaDialogOpen(false)} disabled={bajaLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleBajaConfirm}
            color="error"
            variant="contained"
            disabled={bajaLoading}
            startIcon={bajaLoading ? <CircularProgress size={14} /> : undefined}
          >
            Dar de baja
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
