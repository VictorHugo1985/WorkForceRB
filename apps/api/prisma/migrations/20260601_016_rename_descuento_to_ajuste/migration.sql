-- Migration: Rename descuento_* columns to ajuste_* and TipoDescuentoDia enum to TipoAjusteDia
-- Feature: 016 — payroll planilla (schema alignment)
-- Rationale: "ajuste" is semantically correct (can be increase or decrease);
--             "descuento" incorrectly implied reduction-only.

-- Step 1: Rename the PostgreSQL enum type
ALTER TYPE "TipoDescuentoDia" RENAME TO "TipoAjusteDia";

-- Step 2: Rename the three columns in dias_liquidacion
ALTER TABLE dias_liquidacion RENAME COLUMN descuento_tipo    TO ajuste_tipo;
ALTER TABLE dias_liquidacion RENAME COLUMN descuento_valor   TO ajuste_valor;
ALTER TABLE dias_liquidacion RENAME COLUMN descuento_motivo  TO ajuste_descripcion;
