'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from '@/lib/SnackbarContext';
import {
  previewPuntajeFinal,
  type CriteriosVigentesResponse,
} from '@/lib/evaluaciones-types';

const ESCALA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function todayGMTMinus4(): string {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface NuevaEvaluacionDialogProps {
  open: boolean;
  colaborador: { id: string; nombre: string; apellido: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function NuevaEvaluacionDialog({ open, colaborador, onClose, onSaved }: NuevaEvaluacionDialogProps) {
  const { showSuccess, showError } = useSnackbar();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [config, setConfig] = useState<CriteriosVigentesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [puntajes, setPuntajes] = useState<Record<string, number>>({});
  const [fecha, setFecha] = useState(todayGMTMinus4());
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const handleSessionExpired = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login?reason=expired');
  }, [router]);

  const loadCriterios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/evaluaciones/criterios-vigentes');
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) { setError('No se pudieron cargar los criterios de evaluación.'); return; }
      const data: CriteriosVigentesResponse = await res.json();
      setConfig(data);
      // Conserva los puntajes de criterios que siguen vigentes.
      setPuntajes((prev) =>
        Object.fromEntries(data.criterios.filter((c) => prev[c.id]).map((c) => [c.id, prev[c.id]])),
      );
    } catch {
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    if (!open) return;
    setPuntajes({});
    setFecha(todayGMTMinus4());
    setComentario('');
    setError(null);
    setAviso(null);
    setConfig(null);
    loadCriterios();
  }, [open, loadCriterios]);

  const criterios = config?.criterios ?? [];
  const faltantes = criterios.filter((c) => !puntajes[c.id]);
  const completo = criterios.length > 0 && faltantes.length === 0;
  const hoy = todayGMTMinus4();
  const fechaValida = !!fecha && fecha <= hoy;

  const preview = useMemo(
    () =>
      completo ? previewPuntajeFinal(criterios.map((c) => ({ peso: c.peso, puntaje: puntajes[c.id] }))) : null,
    [completo, criterios, puntajes],
  );

  const handleSave = async () => {
    if (!colaborador || !config) return;
    if (!completo) {
      setError(`Faltan puntajes para: ${faltantes.map((c) => c.nombre).join(', ')}.`);
      return;
    }
    if (!fechaValida) { setError('La fecha de evaluación no puede ser futura.'); return; }
    setSaving(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch('/api/evaluaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador_id: colaborador.id,
          fecha_evaluacion: fecha,
          comentario: comentario.trim() || null,
          config_version: config.config_version,
          puntajes: criterios.map((c) => ({ criterio_id: c.id, puntaje: puntajes[c.id] })),
        }),
      });
      if (res.status === 401) { handleSessionExpired(); return; }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.error === 'CRITERIOS_CAMBIARON') {
          setAviso('Los criterios cambiaron mientras completaba la evaluación. Se recargó el formulario; revise los puntajes.');
          await loadCriterios();
          return;
        }
        if (body.error === 'CRITERIOS_NO_SUMAN_100') {
          await loadCriterios();
          return;
        }
        const mensajes: Record<string, string> = {
          COLABORADOR_NOT_FOUND: 'El colaborador no existe.',
          COLABORADOR_INACTIVO: 'El colaborador está inactivo y no puede ser evaluado.',
        };
        setError(mensajes[body.error] ?? body.error ?? 'Error al registrar la evaluación.');
        return;
      }
      showSuccess('Evaluación registrada.');
      onSaved();
      onClose();
    } catch {
      showError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        Nueva evaluación
        {colaborador && (
          <Typography variant="body2" color="text.secondary">
            {colaborador.apellido}, {colaborador.nombre}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {loading && !config ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {aviso && <Alert severity="warning">{aviso}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            {config && !config.configuracion_valida && (
              <Alert severity="warning">
                Los criterios de evaluación no suman 100% (suma actual: {config.suma_activos}%). Un
                administrador debe ajustarlos en Configuración → Criterios de evaluación.
              </Alert>
            )}

            {config?.configuracion_valida &&
              criterios.map((c) => (
                <Box key={c.id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                    <Typography variant="subtitle2">{c.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Peso {c.peso}%
                    </Typography>
                  </Box>
                  {c.descripcion && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {c.descripcion}
                    </Typography>
                  )}
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    color="primary"
                    value={puntajes[c.id] ?? null}
                    onChange={(_, v: number | null) => {
                      if (v !== null) setPuntajes((p) => ({ ...p, [c.id]: v }));
                    }}
                    sx={{ flexWrap: 'wrap' }}
                    aria-label={`Puntaje ${c.nombre}`}
                  >
                    {ESCALA.map((n) => (
                      <ToggleButton key={n} value={n} sx={{ minWidth: 36, px: 1 }}>
                        {n}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              ))}

            {config?.configuracion_valida && (
              <>
                <Divider />
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <TextField
                    label="Fecha de evaluación"
                    type="date"
                    size="small"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    error={!fechaValida}
                    helperText={!fechaValida ? 'No puede ser una fecha futura.' : ' '}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy } }}
                    sx={{ minWidth: 200 }}
                  />
                  <Box sx={{ flex: 1, textAlign: { xs: 'left', sm: 'right' } }}>
                    <Typography variant="caption" color="text.secondary">
                      Puntaje final (vista previa)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {preview ?? '—'}
                      <Typography component="span" variant="body2" color="text.secondary"> / 10</Typography>
                    </Typography>
                  </Box>
                </Box>
                <TextField
                  label="Comentario (opcional)"
                  multiline
                  minRows={3}
                  size="small"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                  helperText={`${comentario.length}/1000`}
                />
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || !config?.configuracion_valida || !completo || !fechaValida}
        >
          {saving ? 'Guardando…' : 'Guardar evaluación'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
