'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import { DiaLiquidacionData, useLiquidacionStore } from '@/stores/liquidacion.store';

const schema = z
  .object({
    horasAjustadasSupervisor: z.union([z.number().min(0), z.literal('')]).optional(),
    motivoAjuste: z.string().optional(),
    descuentoTipo: z.string().optional(),
    descuentoValor: z.union([z.number().positive(), z.literal('')]).optional(),
    descuentoMotivo: z.string().optional(),
    aprobar: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const horas = data.horasAjustadasSupervisor;
    if (horas !== '' && horas !== undefined && !data.motivoAjuste) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Motivo requerido si se ajustan las horas',
        path: ['motivoAjuste'],
      });
    }
    if (data.descuentoTipo && data.descuentoTipo !== '') {
      if (!data.descuentoValor && data.descuentoValor !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valor requerido si se aplica un descuento',
          path: ['descuentoValor'],
        });
      }
      if (!data.descuentoMotivo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Motivo requerido si se aplica un descuento',
          path: ['descuentoMotivo'],
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  dia: DiaLiquidacionData;
  open: boolean;
  onClose: () => void;
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function DiaAjusteDialog({ dia, open, onClose }: Props) {
  const { applyOptimisticDia, reconcileDia, applyOptimisticTotales, liquidacion } =
    useLiquidacionStore();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    register,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      horasAjustadasSupervisor: dia.horasAjustadasSupervisor ?? '',
      motivoAjuste: dia.motivoAjuste ?? '',
      descuentoTipo: (dia.descuentoTipo as FormValues['descuentoTipo']) ?? '',
      descuentoValor: dia.descuentoValor ?? '',
      descuentoMotivo: dia.descuentoMotivo ?? '',
      aprobar: false,
    },
  });

  const descuentoTipo = watch('descuentoTipo');
  const horasField = watch('horasAjustadasSupervisor');

  const onSubmit = async (values: FormValues) => {
    setError(null);

    const body: Record<string, unknown> = {};
    if (values.horasAjustadasSupervisor !== '' && values.horasAjustadasSupervisor !== undefined) {
      body.horasAjustadasSupervisor = values.horasAjustadasSupervisor;
      body.motivoAjuste = values.motivoAjuste;
    }
    if (values.descuentoTipo && values.descuentoTipo !== '') {
      body.descuentoTipo = values.descuentoTipo;
      body.descuentoValor = values.descuentoValor;
      body.descuentoMotivo = values.descuentoMotivo;
    }
    if (values.aprobar) body.aprobar = true;

    const optimisticDia: DiaLiquidacionData = {
      ...dia,
      ...(body.horasAjustadasSupervisor !== undefined && {
        horasAjustadasSupervisor: body.horasAjustadasSupervisor as number,
        motivoAjuste: body.motivoAjuste as string,
      }),
      ...(body.descuentoTipo !== undefined && {
        descuentoTipo: body.descuentoTipo as string,
        descuentoValor: body.descuentoValor as number,
        descuentoMotivo: body.descuentoMotivo as string,
      }),
    };
    applyOptimisticDia(optimisticDia);

    try {
      const res = await fetch(`/api/dias-liquidacion/${dia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        reconcileDia(dia);
        setError(json?.message ?? `Error ${res.status}`);
        return;
      }

      const json = await res.json();
      reconcileDia(json.dia);
      applyOptimisticTotales(json.totales);
      onClose();
    } catch (err) {
      reconcileDia(dia);
      setError('Error de red. Intente de nuevo.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Ajustar día — {formatFecha(dia.fecha)}</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Horas ajustadas"
              type="number"
              size="small"
              slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
              {...register('horasAjustadasSupervisor', { valueAsNumber: true })}
              error={!!errors.horasAjustadasSupervisor}
              helperText={errors.horasAjustadasSupervisor?.message}
            />

            {(horasField !== '' && horasField !== undefined) && (
              <TextField
                label="Motivo del ajuste"
                size="small"
                {...register('motivoAjuste')}
                error={!!errors.motivoAjuste}
                helperText={errors.motivoAjuste?.message}
              />
            )}

            <Controller
              name="descuentoTipo"
              control={control}
              render={({ field }) => (
                <FormControl size="small" error={!!errors.descuentoTipo}>
                  <InputLabel>Tipo de descuento</InputLabel>
                  <Select label="Tipo de descuento" {...field}>
                    <MenuItem value="">Sin descuento</MenuItem>
                    <MenuItem value="TARIFA_DIA">Reducción de tarifa</MenuItem>
                    <MenuItem value="MONTO_FIJO">Monto fijo</MenuItem>
                  </Select>
                  {errors.descuentoTipo && (
                    <FormHelperText>{errors.descuentoTipo.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />

            {descuentoTipo && descuentoTipo !== '' && (
              <>
                <TextField
                  label={descuentoTipo === 'TARIFA_DIA' ? 'Tarifa (Bs./h)' : 'Monto (Bs.)'}
                  type="number"
                  size="small"
                  slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                  {...register('descuentoValor', { valueAsNumber: true })}
                  error={!!errors.descuentoValor}
                  helperText={errors.descuentoValor?.message}
                />
                <TextField
                  label="Motivo del descuento"
                  size="small"
                  {...register('descuentoMotivo')}
                  error={!!errors.descuentoMotivo}
                  helperText={errors.descuentoMotivo?.message}
                />
              </>
            )}

            <FormControlLabel
              control={<Checkbox {...register('aprobar')} />}
              label="Aprobar día sin ajuste"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Guardar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
