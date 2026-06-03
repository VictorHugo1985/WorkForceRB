'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
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
    ajusteTipo: z.string().optional(),
    ajusteValor: z.union([z.number().positive(), z.literal('')]).optional(),
    aprobar: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.ajusteTipo && data.ajusteTipo !== '') {
      if (!data.ajusteValor && data.ajusteValor !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valor requerido si se aplica un ajuste',
          path: ['ajusteValor'],
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      horasAjustadasSupervisor: dia.horasAjustadasSupervisor ?? '',
      ajusteTipo: (dia.ajusteTipo as FormValues['ajusteTipo']) ?? '',
      ajusteValor: dia.ajusteValor ?? '',
      aprobar: false,
    },
  });

  const ajusteTipo = watch('ajusteTipo');
  const horasField = watch('horasAjustadasSupervisor');

  const onSubmit = async (values: FormValues) => {
    setError(null);

    const body: Record<string, unknown> = {};
    if (values.horasAjustadasSupervisor !== '' && values.horasAjustadasSupervisor !== undefined) {
      body.horasAjustadasSupervisor = values.horasAjustadasSupervisor;
    }
    if (values.ajusteTipo && values.ajusteTipo !== '') {
      body.ajusteTipo = values.ajusteTipo;
      body.ajusteValor = values.ajusteValor;
    }
    if (values.aprobar) body.aprobar = true;

    const optimisticDia: DiaLiquidacionData = {
      ...dia,
      ...(body.horasAjustadasSupervisor !== undefined && {
        horasAjustadasSupervisor: body.horasAjustadasSupervisor as number,
      }),
      ...(body.ajusteTipo !== undefined && {
        ajusteTipo: body.ajusteTipo as string,
        ajusteValor: body.ajusteValor as number,
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

          {dia.tieneInconsistencia && dia.marcacionSuelta && (
            <>
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                action={
                  <Button
                    size="small"
                    color="warning"
                    variant="outlined"
                    onClick={() => {
                      setValue('horasAjustadasSupervisor', dia.horasParejadas ?? 0);
                    }}
                  >
                    Excluir marcación suelta
                  </Button>
                }
              >
                Marcación suelta detectada: {dia.marcacionSuelta} — completa las jornadas pareadas: {(dia.horasParejadas ?? 0).toFixed(2)} h
              </Alert>
              <Divider sx={{ mb: 2 }} />
            </>
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

            <Controller
              name="ajusteTipo"
              control={control}
              render={({ field }) => (
                <FormControl size="small" error={!!errors.ajusteTipo}>
                  <InputLabel>Tipo de ajuste</InputLabel>
                  <Select label="Tipo de ajuste" {...field}>
                    <MenuItem value="">Sin ajuste</MenuItem>
                    <MenuItem value="TARIFA_DIA">Ajuste de tarifa</MenuItem>
                    <MenuItem value="MONTO_FIJO">Monto fijo</MenuItem>
                  </Select>
                  {errors.ajusteTipo && (
                    <FormHelperText>{errors.ajusteTipo.message}</FormHelperText>
                  )}
                </FormControl>
              )}
            />

            {ajusteTipo && ajusteTipo !== '' && (
              <>
                <TextField
                  label={ajusteTipo === 'TARIFA_DIA' ? 'Tarifa (Bs./h)' : 'Monto (Bs.)'}
                  type="number"
                  size="small"
                  slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                  {...register('ajusteValor', { valueAsNumber: true })}
                  error={!!errors.ajusteValor}
                  helperText={errors.ajusteValor?.message}
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
