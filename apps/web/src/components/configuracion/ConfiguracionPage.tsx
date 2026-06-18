'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { AreasSection } from './AreasSection';
import { TiposAjusteSection } from './TiposAjusteSection';
import { TiposPeriodoPagoSection } from './TiposPeriodoPagoSection';

export function ConfiguracionPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Áreas" />
        <Tab label="Tipos de Ajuste" />
        <Tab label="Tipos de Período de Pago" />
      </Tabs>

      {tab === 0 && <AreasSection />}
      {tab === 1 && <TiposAjusteSection />}
      {tab === 2 && <TiposPeriodoPagoSection />}
    </Box>
  );
}
