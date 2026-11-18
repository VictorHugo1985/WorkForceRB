'use client';

import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { LiquidacionData, useLiquidacionStore } from '@/stores/liquidacion.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { DiaLiquidacionTable } from './DiaLiquidacionTable';
import { LiquidacionSummaryCard } from './LiquidacionSummaryCard';
import { BonoSectionPanel } from './BonoSectionPanel';
import { AprobarLiquidacionButton } from './AprobarLiquidacionButton';

interface Props {
  initialData: LiquidacionData;
  semanaFechas: { fechaInicio: string; fechaFin: string };
}

export function LiquidacionDetailClient({ initialData, semanaFechas }: Props) {
  const { setLiquidacion } = useLiquidacionStore();

  useEffect(() => {
    setLiquidacion(initialData);
  }, [initialData, setLiquidacion]);

  return (
    <Box>
      <PageHeader title="Liquidación Semanal" />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <DiaLiquidacionTable />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <LiquidacionSummaryCard />
          <AprobarLiquidacionButton
            semanaLabel={`${semanaFechas.fechaInicio} – ${semanaFechas.fechaFin}`}
          />
        </Grid>
      </Grid>

      <BonoSectionPanel
        semanaId={initialData.semanaId}
        colaboradorId={initialData.colaboradorId}
        fechaInicio={semanaFechas.fechaInicio}
        fechaFin={semanaFechas.fechaFin}
      />
    </Box>
  );
}
