'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { AreasSection } from './AreasSection';
import { CriteriosEvaluacionSection } from './CriteriosEvaluacionSection';
import { TiposAjusteSection } from './TiposAjusteSection';
import { TiposPeriodoPagoSection } from './TiposPeriodoPagoSection';

export function ConfiguracionPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Áreas" />
        <Tab label="Tipos de Ajuste" />
        <Tab label="Tipos de Período de Pago" />
        <Tab label="Criterios de evaluación" />
      </Tabs>

      {tab === 0 && <AreasSection />}
      {tab === 1 && <TiposAjusteSection />}
      {tab === 2 && <TiposPeriodoPagoSection />}
      {tab === 3 && <CriteriosEvaluacionSection />}
    </Box>
  );
}
