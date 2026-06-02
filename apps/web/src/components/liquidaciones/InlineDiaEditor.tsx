'use client';

import { useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function computeShiftHours(entrada: string, salida: string): number {
  if (!TIME_RE.test(entrada) || !TIME_RE.test(salida)) return 0;
  const diff = timeToMinutes(salida) - timeToMinutes(entrada);
  return diff > 0 ? Math.round(diff / 60 * 100) / 100 : 0;
}

const jornadaRow = z.object({
  entrada: z.string().optional(),
  salida: z.string().optional(),
}).refine(
  (j) => {
    if (!j.entrada && !j.salida) return true;
    if (j.entrada && !TIME_RE.test(j.entrada)) return false;
    if (j.salida && !TIME_RE.test(j.salida)) return false;
    return true;
  },
  { message: 'Formato HH:MM' },
);

const schema = z.object({
  jornadas: z.array(jornadaRow),
  horasOverride: z.union([z.number().min(0), z.literal('')]).optional(),
  motivoAjuste: z.string().optional(),
  ajusteTipo: z.string().optional(),
  ajusteValor: z.union([z.number().positive(), z.literal('')]).optional(),
  ajusteDescripcion: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasJornadas = data.jornadas.some((j) => j.entrada || j.salida);
  const hasHorasOverride = data.horasOverride !== '' && data.horasOverride !== undefined;
  if ((hasJornadas || hasHorasOverride) && !data.motivoAjuste?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Motivo requerido', path: ['motivoAjuste'] });
  }
  if (data.ajusteTipo && data.ajusteTipo !== '') {
    if (!data.ajusteValor && data.ajusteValor !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Requerido', path: ['ajusteValor'] });
    }
    if (!data.ajusteDescripcion?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Requerida', path: ['ajusteDescripcion'] });
    }
  }
});

type FormValues = z.infer<typeof schema>;

interface Props {
  dia: DiaLiquidacionData;
  onSaved: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
  onCancel: () => void;
}

export function InlineDiaEditor({ dia, onSaved, onCancel }: Props) {
  const [saveError, setSaveError] = useState<string | null>(null);

  const existingJornadas = (dia.jornadas ?? []).map((j) => ({
    entrada: j.entrada ?? '',
    salida: j.salida ?? '',
  }));

  // If there's an unpaired punch, add it as a partial jornada (salida blank)
  const initialJornadas = existingJornadas.length > 0
    ? [
        ...existingJornadas,
        ...(dia.marcacionSuelta ? [{ entrada: dia.marcacionSuelta, salida: '' }] : []),
      ]
    : [{ entrada: '', salida: '' }];

  const { control, handleSubmit, register, watch, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        jornadas: initialJornadas,
        horasOverride: dia.horasAjustadasSupervisor ?? '',
        motivoAjuste: dia.motivoAjuste ?? '',
        ajusteTipo: dia.ajusteTipo ?? '',
        ajusteValor: dia.ajusteValor ?? '',
        ajusteDescripcion: dia.ajusteDescripcion ?? '',
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'jornadas' });
  const jornadas = watch('jornadas');
  const ajusteTipo = watch('ajusteTipo');

  const computedHours = jornadas.reduce((sum, j) => sum + computeShiftHours(j.entrada ?? '', j.salida ?? ''), 0);
  const hasJornadaData = jornadas.some((j) => j.entrada || j.salida);

  const onSubmit = async (values: FormValues) => {
    setSaveError(null);

    const body: Record<string, unknown> = {};

    // Determine effective hours: prefer jornada-computed, then manual override
    const hasValidJornadas = values.jornadas.some(
      (j) => j.entrada && j.salida && TIME_RE.test(j.entrada) && TIME_RE.test(j.salida),
    );
    if (hasValidJornadas) {
      body.horasAjustadasSupervisor = computedHours;
      body.motivoAjuste = values.motivoAjuste?.trim() ?? '';
    } else if (values.horasOverride !== '' && values.horasOverride !== undefined) {
      body.horasAjustadasSupervisor = values.horasOverride;
      body.motivoAjuste = values.motivoAjuste?.trim() ?? '';
    }

    if (values.ajusteTipo && values.ajusteTipo !== '') {
      body.ajusteTipo = values.ajusteTipo;
      body.ajusteValor = values.ajusteValor;
      body.ajusteDescripcion = values.ajusteDescripcion?.trim();
    } else if (dia.ajusteTipo) {
      // Explicitly clear previously set adjustment
      body.ajusteTipo = null;
    }

    if (Object.keys(body).length === 0) {
      onCancel();
      return;
    }

    try {
      const res = await fetch(`/api/dias-liquidacion/${dia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        setSaveError(err.message ?? `Error ${res.status}`);
        return;
      }

      const data = await res.json() as { dia: DiaLiquidacionData; totales: TotalesData };
      onSaved(data.dia, data.totales);
    } catch {
      setSaveError('Error de conexión');
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderTop: 1, borderColor: 'divider' }}
    >
      {saveError && <Alert severity="error" sx={{ mb: 1.5 }}>{saveError}</Alert>}

      {/* Marcaciones */}
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: 0.5 }}>
        MARCACIONES
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5, mb: 1.5 }}>
        {fields.map((field, i) => {
          const shiftH = computeShiftHours(jornadas[i]?.entrada ?? '', jornadas[i]?.salida ?? '');
          return (
            <Box key={field.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                label="Entrada"
                type="time"
                {...register(`jornadas.${i}.entrada`)}
                error={!!errors.jornadas?.[i]}
                sx={{ width: 120 }}
                slotProps={{ htmlInput: { step: 60 } }}
              />
              <Typography color="text.secondary" sx={{ userSelect: 'none' }}>→</Typography>
              <TextField
                size="small"
                label="Salida"
                type="time"
                {...register(`jornadas.${i}.salida`)}
                error={!!errors.jornadas?.[i]}
                helperText={errors.jornadas?.[i]?.message}
                sx={{ width: 120 }}
                slotProps={{ htmlInput: { step: 60 } }}
              />
              {shiftH > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {shiftH.toFixed(2)} h
                </Typography>
              )}
              {fields.length > 1 && (
                <IconButton size="small" onClick={() => remove(i)} tabIndex={-1} sx={{ ml: -0.5 }}>
                  <RemoveCircleIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          );
        })}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.25 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => append({ entrada: '', salida: '' })}
            sx={{ alignSelf: 'flex-start' }}
          >
            Turno
          </Button>
          {hasJornadaData && computedHours > 0 && (
            <Typography variant="caption" color="text.secondary">
              Total: <strong>{computedHours.toFixed(2)} h</strong>
            </Typography>
          )}
        </Box>
      </Box>

      {/* Hours + motivo row */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <TextField
          size="small"
          label="Horas ajustadas"
          type="number"
          {...register('horasOverride', { valueAsNumber: true })}
          error={!!errors.horasOverride}
          helperText={
            errors.horasOverride?.message ??
            (hasJornadaData && computedHours > 0 ? `Auto: ${computedHours.toFixed(2)}` : undefined)
          }
          sx={{ width: 140 }}
          slotProps={{ htmlInput: { step: 0.25, min: 0 } }}
        />
        <TextField
          size="small"
          label="Motivo *"
          {...register('motivoAjuste')}
          error={!!errors.motivoAjuste}
          helperText={errors.motivoAjuste?.message}
          sx={{ flex: 1, minWidth: 180 }}
        />
      </Box>

      {/* Adjustment type row */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Controller
          name="ajusteTipo"
          control={control}
          render={({ field }) => (
            <FormControl size="small" sx={{ width: 190 }} error={!!errors.ajusteTipo}>
              <InputLabel>Tipo de ajuste</InputLabel>
              <Select label="Tipo de ajuste" {...field}>
                <MenuItem value="">Sin ajuste</MenuItem>
                <MenuItem value="TARIFA_DIA">Tarifa del día</MenuItem>
                <MenuItem value="MONTO_FIJO">Monto fijo</MenuItem>
              </Select>
              {errors.ajusteTipo && <FormHelperText>{errors.ajusteTipo.message}</FormHelperText>}
            </FormControl>
          )}
        />

        {ajusteTipo && ajusteTipo !== '' && (
          <>
            <TextField
              size="small"
              label={ajusteTipo === 'TARIFA_DIA' ? 'Tarifa (Bs./h)' : 'Monto (Bs.)'}
              type="number"
              {...register('ajusteValor', { valueAsNumber: true })}
              error={!!errors.ajusteValor}
              helperText={errors.ajusteValor?.message}
              sx={{ width: 140 }}
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
            />
            <TextField
              size="small"
              label="Descripción"
              {...register('ajusteDescripcion')}
              error={!!errors.ajusteDescripcion}
              helperText={errors.ajusteDescripcion?.message}
              sx={{ flex: 1, minWidth: 180 }}
            />
          </>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          type="submit"
          variant="contained"
          size="small"
          disabled={isSubmitting}
          endIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Guardar
        </Button>
        <Button size="small" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
      </Box>
    </Box>
  );
}
