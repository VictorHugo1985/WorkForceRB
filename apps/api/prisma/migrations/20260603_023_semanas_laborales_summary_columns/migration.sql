-- Add summary columns to semanas_laborales for historical reporting.
-- Populated when a period is closed via the /cerrar endpoint.

ALTER TABLE semanas_laborales
  ADD COLUMN IF NOT EXISTS monto_total_pagado NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS cantidad_colaboradores_pagados INTEGER;
