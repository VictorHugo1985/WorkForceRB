'use client';

import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { PageHeader } from '@/components/ui/PageHeader';
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

function formatSemana(s: SemanaLaboral) {
  const ini = (s.fecha_inicio as string).slice(0, 10);
  const fin = (s.fecha_fin as string).slice(0, 10);
  return `${ini} – ${fin}`;
}

export function PlanillaView() {
  const [semanas, setSemanas] = useState<SemanaLaboral[]>([]);
  const [selectedSemanaId, setSelectedSemanaId] = useState<string>('');
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [maxShifts, setMaxShifts] = useState(1);
  const [loadingSemanas, setLoadingSemanas] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Load week list on mount
  useEffect(() => {
    fetch('/api/semanas-laborales')
      .then((r) => r.json())
      .then((rows: SemanaLaboral[]) => {
        setSemanas(rows);
        const abierta = rows.find((s) => s.estado === 'ABIERTA');
        if (abierta) setSelectedSemanaId(abierta.id);
        else if (rows.length > 0) setSelectedSemanaId(rows[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingSemanas(false));
  }, []);

  // Load roster when selected week changes
  useEffect(() => {
    if (!selectedSemanaId) return;
    setLoadingRoster(true);
    setRoster([]);
    fetch(`/api/planilla/${selectedSemanaId}`)
      .then((r) => r.json())
      .then((data: { maxShifts: number; colaboradores: RosterEntry[] }) => {
        setMaxShifts(data.maxShifts ?? 1);
        setRoster(data.colaboradores ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingRoster(false));
  }, [selectedSemanaId]);

  const handleSemanaChange = (e: SelectChangeEvent) => {
    setSelectedSemanaId(e.target.value);
  };

  const handleEstadoChange = useCallback((liquidacionId: string, estado: 'APROBADO') => {
    setRoster((prev) =>
      prev.map((entry) =>
        entry.liquidacionId === liquidacionId ? { ...entry, estado } : entry,
      ),
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
      <PageHeader
        title="Planilla Semanal"
        action={allAprobado ? <Chip label="Semana completa" color="success" /> : undefined}
      />

      <Box sx={{ mb: 3, maxWidth: 400 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Semana</InputLabel>
          <Select label="Semana" value={selectedSemanaId} onChange={handleSemanaChange}>
            {semanas.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {formatSemana(s)}
                {s.estado === 'ABIERTA' && (
                  <Chip label="Activa" size="small" color="info" sx={{ ml: 1 }} />
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loadingRoster ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : roster.length === 0 ? (
        <Typography color="text.secondary">
          No hay registros de asistencia para esta semana.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {roster.map((entry) =>
            entry.liquidacionId ? (
              <LiquidacionColaborador
                key={entry.liquidacionId}
                liquidacionId={entry.liquidacionId}
                colaboradorId={entry.colaboradorId}
                nombre={entry.nombre}
                apellido={entry.apellido}
                semanaId={selectedSemanaId}
                maxShifts={maxShifts}
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
