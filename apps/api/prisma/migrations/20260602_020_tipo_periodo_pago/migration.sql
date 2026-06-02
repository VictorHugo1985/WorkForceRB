BEGIN;

CREATE TYPE "TipoPeriodoPago" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL');

ALTER TABLE colaboradores
  ADD COLUMN tipo_pago "TipoPeriodoPago" NULL;

ALTER TABLE semanas_laborales
  ADD COLUMN tipo_periodo "TipoPeriodoPago" NULL,
  ADD COLUMN creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN colaboradores.tipo_pago IS 'Frecuencia de pago habitual del colaborador';
COMMENT ON COLUMN semanas_laborales.tipo_periodo IS 'Tipo de período: semanal, quincenal o mensual';
COMMENT ON COLUMN semanas_laborales.creado_por IS 'Usuario que creó el período de pago';

COMMIT;
