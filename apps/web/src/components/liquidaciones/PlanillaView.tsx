'use client';

import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { LiquidacionColaborador } from './LiquidacionColaborador';

interface SemanaLaboral {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
}

interface RosterEntry {
  liquidacionId: string | null;
  colaboradorId: string;
  nombre: string;
  apellido: string;
  tarifaHora: number | null;
  estado: string;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatSemanaLabel(s: SemanaLaboral) {
  const ini = new Date(s.fecha_inicio.slice(0, 10) + 'T12:00:00Z');
  const fin = new Date(s.fecha_fin.slice(0, 10) + 'T12:00:00Z');
  return `${ini.getUTCDate()} – ${fin.getUTCDate()} ${MESES[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`;
}

export function PlanillaView() {
  const [semanas, setSemanas] = useState<SemanaLaboral[]>([]);
  // semanas is sorted DESC (index 0 = newest). semanaIndex tracks current position.
  const [semanaIndex, setSemanaIndex] = useState<number>(-1);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loadingSemanas, setLoadingSemanas] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);

  useEffect(() => {
    fetch('/api/semanas-laborales')
      .then((r) => r.json())
      .then((rows: SemanaLaboral[]) => {
        setSemanas(rows);
        const idx = rows.findIndex((s) => s.estado === 'ABIERTA');
        setSemanaIndex(idx >= 0 ? idx : rows.length > 0 ? 0 : -1);
      })
      .catch(() => {})
      .finally(() => setLoadingSemanas(false));
  }, []);

  const semanaActual = semanaIndex >= 0 ? semanas[semanaIndex] : null;

  useEffect(() => {
    if (!semanaActual) return;
    setLoadingRoster(true);
    setRoster([]);
    fetch(`/api/planilla/${semanaActual.id}`)
      .then((r) => r.json())
      .then((data: { colaboradores: RosterEntry[] }) => {
        setRoster(data.colaboradores ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingRoster(false));
  }, [semanaActual]);

  const handleEstadoChange = useCallback((liquidacionId: string, estado: 'APROBADO') => {
    setRoster((prev) =>
      prev.map((e) => e.liquidacionId === liquidacionId ? { ...e, estado } : e),
    );
  }, []);

  const allAprobado = roster.length > 0 && roster.every((e) => e.estado === 'APROBADO');

  if (loadingSemanas) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ─── Week header with prev / next navigation ─── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 3,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <IconButton
          size="small"
          onClick={() => setSemanaIndex((i) => i + 1)}
          disabled={semanaIndex >= semanas.length - 1}
          aria-label="Semana anterior"
        >
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>

        <Box sx={{ flex: 1, textAlign: 'center' }}>
          {semanaActual ? (
            <>
              <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                {formatSemanaLabel(semanaActual)}
              </Typography>
              <Box sx={{ mt: 0.25 }}>
                {semanaActual.estado === 'ABIERTA' ? (
                  <Chip label="Abierta" size="small" color="success" />
                ) : (
                  <Chip label={semanaActual.estado} size="small" variant="outlined" />
                )}
                {allAprobado && (
                  <Chip label="Semana completa" size="small" color="info" sx={{ ml: 1 }} />
                )}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary">Sin semanas registradas</Typography>
          )}
        </Box>

        <IconButton
          size="small"
          onClick={() => setSemanaIndex((i) => i - 1)}
          disabled={semanaIndex <= 0}
          aria-label="Semana siguiente"
        >
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ─── Collaborator blocks ─── */}
      {loadingRoster ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : roster.length === 0 ? (
        <Typography color="text.secondary">
          No hay registros de asistencia para esta semana.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {roster.map((entry) =>
            entry.liquidacionId ? (
              <LiquidacionColaborador
                key={entry.liquidacionId}
                liquidacionId={entry.liquidacionId}
                colaboradorId={entry.colaboradorId}
                nombre={entry.nombre}
                apellido={entry.apellido}
                semanaId={semanaActual!.id}
                tarifaHora={entry.tarifaHora}
                onEstadoChange={handleEstadoChange}
              />
            ) : null,
          )}
        </Box>
      )}
    </Box>
  );
}
