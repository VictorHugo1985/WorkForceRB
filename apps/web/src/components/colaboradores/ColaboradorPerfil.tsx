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
import InputAdornment from '@mui/material/InputAdornment';
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

type TipoPago = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL';

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
  area: { id: string; nombre: string } | null;
  tarifa_hora: number | null;
  tipo_pago: TipoPago | null;
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
  area_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
  tarifa_hora: z.string().optional().or(z.literal('')),
  tipo_pago: z.enum(['SEMANAL', 'QUINCENAL', 'MENSUAL']).or(z.literal('')).nullable().optional(),
  plantilla_horario_id: z.union([z.string().uuid(), z.literal(''), z.null()]).optional(),
});
type EditFormValues = z.infer<typeof EditSchema>;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>{value ?? '—'}</Typography>
    </Box>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 3, mb: 1 }}>{children}</Typography>
      <Divider sx={{ mb: 1 }} />
    </>
  );
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const TIPO_PAGO_LABEL: Record<TipoPago, string> = {
  SEMANAL: 'Semanal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
};

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
    area: perfil.area,
  });
  const [tarifaHora, setTarifaHora] = useState<number | null>(perfil.tarifa_hora);
  const [tipoPago, setTipoPago] = useState<TipoPago | null>(perfil.tipo_pago);
  const [plantilla, setPlantilla] = useState<PlantillaHorario | null>(perfil.plantilla_horario);
  const [localCodigos, setLocalCodigos] = useState<CodigoBiometrico[]>(perfil.codigos_biometricos);
  const [worknos, setWorknos] = useState<Record<string, string>>(
    Object.fromEntries(perfil.codigos_biometricos.map((c) => [c.id, c.workno])),
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [supervisores, setSupervisores] = useState<{ id: string; nombre: string; apellido: string }[]>([]);
  const [areas, setAreas] = useState<{ id: string; nombre: string }[]>([]);
  const [plantillasDisponibles, setPlantillasDisponibles] = useState<PlantillaHorario[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const [bajaDialogOpen, setBajaDialogOpen] = useState(false);
  const [bajaLoading, setBajaLoading] = useState(false);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<EditFormValues>({
    resolver: zodResolver(EditSchema),
  });

  async function handleEditClick() {
    setLoadingEdit(true);
    try {
      const [supRes, areasRes, plantRes] = await Promise.all([
        fetch('/api/usuarios/supervisores').then((r) => r.json()),
        fetch('/api/areas').then((r) => r.json()),
        fetch('/api/plantillas-horario').then((r) => r.json()),
      ]);
      setSupervisores(supRes.supervisores ?? []);
      setAreas(areasRes.areas ?? []);
      setPlantillasDisponibles(plantRes.plantillas ?? []);
    } catch {
      showError('Error cargando datos del formulario.');
    } finally {
      setLoadingEdit(false);
    }
    reset({
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      telefono: data.telefono ?? '',
      fecha_nacimiento: data.fecha_nacimiento ?? '',
      supervisor_id: data.supervisor?.id ?? '',
      area_id: data.area?.id ?? '',
      tarifa_hora: tarifaHora !== null ? String(tarifaHora) : '',
      tipo_pago: tipoPago ?? '',
      plantilla_horario_id: plantilla?.id ?? '',
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
    const area_id = values.area_id || null;
    const plantilla_horario_id = values.plantilla_horario_id || null;
    const tipo_pago = (values.tipo_pago as TipoPago) || null;
    const codigos = localCodigos.map((c) => ({ id: c.id, workno: worknos[c.id] ?? c.workno }));
    const nuevaTarifa = values.tarifa_hora ? Number(values.tarifa_hora) : null;

    try {
      // Main PATCH: personal data + supervisor + area + plantilla + tipo_pago + codigos
      const res = await fetch(`/api/colaboradores/${perfil.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: values.nombre,
          apellido: values.apellido,
          cedula: values.cedula,
          telefono: values.telefono || null,
          fecha_nacimiento: values.fecha_nacimiento || null,
          supervisor_id,
          area_id,
          plantilla_horario_id,
          tipo_pago,
          codigos,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as { message?: string; error?: string })?.message ?? (json as { error?: string })?.error ?? `Error ${res.status}`;
        setEditError(msg);
        showError(`No se pudo guardar: ${msg}`);
        return;
      }

      // Tarifa: separate endpoint if changed
      if (nuevaTarifa !== null && nuevaTarifa !== tarifaHora) {
        const tarifaRes = await fetch(`/api/colaboradores/${perfil.id}/tarifa`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: nuevaTarifa }),
        });
        if (!tarifaRes.ok) {
          const tj = await tarifaRes.json().catch(() => ({}));
          const msg = (tj as { message?: string })?.message ?? 'Error al guardar tarifa';
          setEditError(msg);
          showError(msg);
          return;
        }
        setTarifaHora(nuevaTarifa);
      }

      const supObj = supervisores.find((s) => s.id === supervisor_id) ?? null;
      const areaObj = areas.find((a) => a.id === area_id) ?? null;
      const plantObj = plantillasDisponibles.find((p) => p.id === plantilla_horario_id) ?? null;

      setData((prev) => ({
        ...prev,
        nombre: values.nombre,
        apellido: values.apellido,
        cedula: values.cedula,
        telefono: values.telefono || null,
        fecha_nacimiento: values.fecha_nacimiento || null,
        supervisor: supObj ? { id: supObj.id, nombre: supObj.nombre, apellido: supObj.apellido } : null,
        area: areaObj ? { id: areaObj.id, nombre: areaObj.nombre } : null,
      }));
      setTipoPago(tipo_pago);
      setPlantilla(plantObj);
      setLocalCodigos((prev) => prev.map((c) => ({ ...c, workno: worknos[c.id] ?? c.workno })));
      setIsEditing(false);
      showSuccess('Datos actualizados correctamente.');
    } catch {
      const msg = 'Error de red. Intente de nuevo.';
      setEditError(msg);
      showError(msg);
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
        showError((json as { message?: string })?.message ?? 'No se pudo dar de baja. Intente de nuevo.');
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
        showError((json as { message?: string })?.message ?? 'No se pudo reactivar. Intente de nuevo.');
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

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {data.nombre} {data.apellido}
        </Typography>
        <Chip label={data.activo ? 'Activo' : 'Inactivo'} color={data.activo ? 'success' : 'default'} size="small" />
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {!isEditing && (
            <>
              <Button size="small" variant="outlined" onClick={handleEditClick} disabled={loadingEdit}
                startIcon={loadingEdit ? <CircularProgress size={14} /> : undefined}>
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

      {/* ── Edit form ── */}
      {isEditing ? (
        <Box component="form" onSubmit={handleSubmit(onEditSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {editError && <Alert severity="error">{editError}</Alert>}

          <SectionTitle>Datos personales</SectionTitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField label="Nombre" size="small" {...register('nombre')} error={!!errors.nombre} helperText={errors.nombre?.message} required />
            <TextField label="Apellido" size="small" {...register('apellido')} error={!!errors.apellido} helperText={errors.apellido?.message} required />
          </Box>
          <TextField label="Cédula" size="small" {...register('cedula')} error={!!errors.cedula} helperText={errors.cedula?.message} required />
          <TextField label="Teléfono" size="small" {...register('telefono')} error={!!errors.telefono} helperText={errors.telefono?.message} />
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
          <Controller
            name="area_id"
            control={control}
            render={({ field }) => (
              <FormControl size="small">
                <InputLabel>Área (opcional)</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Área (opcional)">
                  <MenuItem value=""><em>Sin área</em></MenuItem>
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
                  ))}
                </Select>
                {errors.area_id && <FormHelperText error>{errors.area_id.message}</FormHelperText>}
              </FormControl>
            )}
          />

          <SectionTitle>Tarifa y tipo de pago</SectionTitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Tarifa por hora"
              type="number"
              size="small"
              {...register('tarifa_hora')}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">Bs.</InputAdornment> },
                htmlInput: { min: 0.01, step: 0.01 },
              }}
              error={!!errors.tarifa_hora}
              helperText={errors.tarifa_hora?.message}
            />
            <Controller
              name="tipo_pago"
              control={control}
              render={({ field }) => (
                <FormControl size="small">
                  <InputLabel>Tipo de pago</InputLabel>
                  <Select {...field} value={field.value ?? ''} label="Tipo de pago">
                    <MenuItem value=""><em>Sin definir</em></MenuItem>
                    <MenuItem value="SEMANAL">Semanal</MenuItem>
                    <MenuItem value="QUINCENAL">Quincenal</MenuItem>
                    <MenuItem value="MENSUAL">Mensual</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Box>

          <SectionTitle>Plantilla de horario</SectionTitle>
          <Controller
            name="plantilla_horario_id"
            control={control}
            render={({ field }) => (
              <FormControl size="small" fullWidth>
                <InputLabel>Plantilla de horario</InputLabel>
                <Select {...field} value={field.value ?? ''} label="Plantilla de horario">
                  <MenuItem value=""><em>Sin plantilla</em></MenuItem>
                  {plantillasDisponibles.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          />

          {localCodigos.length > 0 && (
            <>
              <SectionTitle>Códigos biométricos</SectionTitle>
              {localCodigos.map((c) => (
                <TextField
                  key={c.id}
                  label={`Workno — ${c.dispositivo.nombre}`}
                  size="small"
                  value={worknos[c.id] ?? ''}
                  onChange={(e) => setWorknos((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  helperText={`S/N: ${c.dispositivo.numero_serie}`}
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
          {/* ── View mode ── */}
          <SectionTitle>Datos personales</SectionTitle>
          <Row label="Cédula" value={data.cedula} />
          <Row label="Teléfono" value={data.telefono} />
          <Row label="Fecha de nacimiento" value={data.fecha_nacimiento ? formatDate(data.fecha_nacimiento) : null} />
          <Row label="Área" value={data.area?.nombre ?? 'Sin área'} />
          <Row label="Supervisor" value={data.supervisor ? `${data.supervisor.nombre} ${data.supervisor.apellido}` : 'Sin supervisor'} />
          <Row label="Registrado el" value={new Date(perfil.creado_en).toLocaleDateString('es-VE')} />

          <SectionTitle>Tarifa y tipo de pago</SectionTitle>
          {tarifaHora !== null ? (
            <Row label="Tarifa por hora" value={`${tarifaHora.toLocaleString('es-VE')} Bs./h`} />
          ) : (
            <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>Sin tarifa configurada — el colaborador no generará valor en las liquidaciones.</Alert>
          )}
          <Row label="Tipo de pago" value={tipoPago ? TIPO_PAGO_LABEL[tipoPago] : null} />

          <SectionTitle>Plantilla de horario</SectionTitle>
          {plantilla ? (
            <>
              <Row label="Plantilla" value={plantilla.nombre} />
              <Row label="Días laborables" value={plantilla.dias_laborables.join(', ')} />
              <Row label="Hora entrada esperada" value={plantilla.hora_entrada_esperada} />
            </>
          ) : (
            <Alert severity="info" sx={{ mt: 1 }}>Sin plantilla asignada — no se detectarán atrasos en las liquidaciones.</Alert>
          )}

          <SectionTitle>Códigos biométricos</SectionTitle>
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

      {/* ── Baja dialog ── */}
      <Dialog open={bajaDialogOpen} onClose={() => setBajaDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Dar de baja al colaborador</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            ¿Está seguro de que desea dar de baja a <strong>{data.nombre} {data.apellido}</strong>?
            El colaborador pasará a estado inactivo. Sus datos históricos se conservarán íntegramente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBajaDialogOpen(false)} disabled={bajaLoading}>Cancelar</Button>
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
