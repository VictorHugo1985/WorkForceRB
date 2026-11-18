'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { DiaLiquidacionData, TotalesData } from '@/stores/liquidacion.store';

const TIPOS = [
  { value: 'BONO_HORAS_EXTRAS', label: 'Bono Horas Extras', color: 'success' },
  { value: 'BONO_TRANSPORTE',   label: 'Bono Transporte',   color: 'success' },
  { value: 'ESTIPENDIO',        label: 'Estipendio',        color: 'success' },
  { value: 'DESCUENTO',         label: 'Descuento',         color: 'warning' },
] as const;

const schema = z.object({
  ajusteTipo: z.string().optional(),
  ajusteValor: z.union([z.number().positive(), z.literal('')]).optional(),
}).superRefine((data, ctx) => {
  if (data.ajusteTipo && data.ajusteTipo !== '') {
    if (!data.ajusteValor && data.ajusteValor !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Requerido', path: ['ajusteValor'] });
    }
  }
});

type FormValues = z.infer<typeof schema>;

interface Props {
  dia: DiaLiquidacionData;
  tarifaHora: number | null;
  onSaved: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
  onCancel: () => void;
}

export function InlineDiaEditor({ dia, tarifaHora, onSaved, onCancel }: Props) {
  const [saveError, setSaveError] = useState<string | null>(null);

  const { control, handleSubmit, register, watch, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        ajusteTipo: dia.ajusteTipo ?? '',
        ajusteValor: dia.ajusteValor ?? '',
      },
    });

  const ajusteTipo = watch('ajusteTipo');
  const isDescuento = ajusteTipo === 'DESCUENTO';
  const isBono = ajusteTipo === 'BONO_HORAS_EXTRAS' || ajusteTipo === 'BONO_FIJO';

  const onSubmit = async (values: FormValues) => {
    setSaveError(null);
    const body: Record<string, unknown> = {};

    if (values.ajusteTipo && values.ajusteTipo !== '') {
      body.ajusteTipo = values.ajusteTipo;
      body.ajusteValor = values.ajusteValor;
    } else if (dia.ajusteTipo) {
      body.ajusteTipo = null;
    }

    if (Object.keys(body).length === 0) { onCancel(); return; }

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

      {tarifaHora !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          Tarifa vigente: <strong>{tarifaHora.toFixed(2)} Bs./h</strong>
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Controller
          name="ajusteTipo"
          control={control}
          render={({ field }) => (
            <FormControl size="small" sx={{ width: 200 }} error={!!errors.ajusteTipo}>
              <InputLabel>Tipo de ajuste</InputLabel>
              <Select label="Tipo de ajuste" {...field}>
                <MenuItem value="">Sin ajuste</MenuItem>
                {TIPOS.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
              {errors.ajusteTipo && <FormHelperText>{errors.ajusteTipo.message}</FormHelperText>}
            </FormControl>
          )}
        />

        {ajusteTipo && ajusteTipo !== '' && (
          <>
            <TextField
              size="small"
              label="Monto (Bs.)"
              type="number"
              {...register('ajusteValor', { valueAsNumber: true })}
              error={!!errors.ajusteValor}
              helperText={errors.ajusteValor?.message}
              sx={{ width: 140 }}
              slotProps={{
                htmlInput: { min: 0.01, step: 0.01 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ color: isDescuento ? 'warning.main' : 'success.main' }}>
                      {isDescuento ? '−' : '+'}
                    </InputAdornment>
                  ),
                },
              }}
            />
          </>
        )}
      </Box>

      {isBono && (
        <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.75 }}>
          Se suma al total del colaborador
        </Typography>
      )}
      {isDescuento && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.75 }}>
          Se descuenta del total del colaborador
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
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
