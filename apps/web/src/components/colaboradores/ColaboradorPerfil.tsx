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

interface PerfilData {
  id: string;
  nombre: string;
  apellido: string;
  cedula: string;
  activo: boolean;
  creado_en: string;
  area: { id: string; nombre: string } | null;
  supervisor: { id: string; nombre: string; apellido: string } | null;
  tarifa_vigente: { id: string; valor: number; unidad: string; vigente_desde: string } | null;
  horario_vigente: { id: string; umbral_horas_extra: number; vigente_desde: string } | null;
  codigos_biometricos: Array<{
    id: string;
    workno: string;
    activo: boolean;
    dispositivo: { id: string; nombre: string; numero_serie: string };
  }>;
}

interface ColaboradorPerfilProps {
  perfil: PerfilData;
}

const EditSchema = z.object({
  nombre: z.string().min(1, 'Requerido').max(100),
  apellido: z.string().min(1, 'Requerido').max(100),
  cedula: z.string().min(1, 'Requerido'),
  area_id: z.string().uuid('Seleccione un área'),
  supervisor_id: z.string().uuid().nullable().optional(),
});
type EditFormValues = z.infer<typeof EditSchema>;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 180 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

export default function ColaboradorPerfil({ perfil }: ColaboradorPerfilProps) {
  const [data, setData] = useState({
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    cedula: perfil.cedula,
    activo: perfil.activo,
    area: perfil.area,
    supervisor: perfil.supervisor,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);
  const [areas, setAreas] = useState<{ id: string; nombre: string }[]>([]);
  const [supervisores, setSupervisores] = useState<{ id: string; nombre: string; apellido: string }[]>([]);

  const [bajaDialogOpen, setBajaDialogOpen] = useState(false);
  const [bajaLoading, setBajaLoading] = useState(false);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<EditFormValues>({
    resolver: zodResolver(EditSchema),
    defaultValues: {
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      area_id: data.area?.id ?? '',
      supervisor_id: data.supervisor?.id ?? null,
    },
  });

  function handleEditClick() {
    Promise.all([
      fetch('/api/areas').then((r) => r.json()).then((d) => setAreas(d.areas ?? [])),
      fetch('/api/usuarios/supervisores').then((r) => r.json()).then((d) => setSupervisores(d.supervisores ?? [])),
    ]);
    reset({
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      area_id: data.area?.id ?? '',
      supervisor_id: data.supervisor?.id ?? null,
    });
    setEditError(null);
    setEditSuccess(false);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setEditError(null);
  }

  async function onEditSubmit(values: EditFormValues) {
    setEditError(null);
    const res = await fetch(`/api/colaboradores/${perfil.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const json = await res.json();
    if (res.status === 409) {
      setEditError('Ya existe un colaborador con la cédula ingresada.');
      return;
    }
    if (!res.ok) {
      setEditError(json.error ?? 'Error al guardar los cambios.');
      return;
    }
    const areaObj = areas.find((a) => a.id === values.area_id) ?? data.area;
    const supObj = supervisores.find((s) => s.id === values.supervisor_id) ?? null;
    setData((prev) => ({
      ...prev,
      nombre: values.nombre,
      apellido: values.apellido,
      cedula: values.cedula,
      area: areaObj ? { id: areaObj.id, nombre: areaObj.nombre } : null,
      supervisor: supObj ? { id: supObj.id, nombre: supObj.nombre, apellido: supObj.apellido } : null,
    }));
    setIsEditing(false);
    setEditSuccess(true);
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
      }
    } finally {
      setBajaLoading(false);
    }
  }

  async function handleReactivar() {
    const res = await fetch(`/api/colaboradores/${perfil.id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: true }),
    });
    if (res.ok) {
      setData((prev) => ({ ...prev, activo: true }));
    }
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      {!data.activo && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Este colaborador está inactivo y no resolverá nuevos eventos biométricos.
        </Alert>
      )}

      {editSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setEditSuccess(false)}>
          Datos actualizados correctamente.
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
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setBajaDialogOpen(true)}
                >
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
          <Controller
            name="area_id"
            control={control}
            render={({ field }) => (
              <FormControl size="small" required error={!!errors.area_id}>
                <InputLabel>Área de trabajo</InputLabel>
                <Select {...field} label="Área de trabajo">
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
                  ))}
                </Select>
                {errors.area_id && <FormHelperText>{errors.area_id.message}</FormHelperText>}
              </FormControl>
            )}
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
              </FormControl>
            )}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
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
          <Row label="Área de trabajo" value={data.area?.nombre ?? '—'} />
          <Row
            label="Supervisor"
            value={data.supervisor ? `${data.supervisor.nombre} ${data.supervisor.apellido}` : 'Sin supervisor'}
          />
          <Row label="Registrado el" value={new Date(perfil.creado_en).toLocaleDateString('es-VE')} />
        </>
      )}

      {!isEditing && (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 3, mb: 1 }}>Tarifa salarial</Typography>
          <Divider sx={{ mb: 1 }} />
          {perfil.tarifa_vigente ? (
            <>
              <Row label="Tarifa por hora" value={`${Number(perfil.tarifa_vigente.valor).toLocaleString()} ${perfil.tarifa_vigente.unidad}`} />
              <Row label="Vigente desde" value={perfil.tarifa_vigente.vigente_desde} />
            </>
          ) : (
            <Alert severity="warning" sx={{ mt: 1 }}>Sin tarifa propia — se usará la tarifa global al liquidar.</Alert>
          )}

          <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 3, mb: 1 }}>Horario laboral</Typography>
          <Divider sx={{ mb: 1 }} />
          {perfil.horario_vigente ? (
            <>
              <Row label="Umbral horas extra / día" value={`${perfil.horario_vigente.umbral_horas_extra} h`} />
              <Row label="Vigente desde" value={perfil.horario_vigente.vigente_desde} />
            </>
          ) : (
            <Alert severity="info" sx={{ mt: 1 }}>Sin horario propio — hereda la configuración global.</Alert>
          )}

          <Typography variant="subtitle1" sx={{ fontWeight: 500, mt: 3, mb: 1 }}>Códigos biométricos</Typography>
          <Divider sx={{ mb: 1 }} />
          {perfil.codigos_biometricos.length === 0 ? (
            <Alert severity="warning">Sin código biométrico asignado. El colaborador no puede resolver marcajes.</Alert>
          ) : (
            perfil.codigos_biometricos.map((c) => (
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
