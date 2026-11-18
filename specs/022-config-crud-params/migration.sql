-- Migration: 022-config-crud-params
-- Run in Supabase SQL Editor
-- Date: 2026-06-18
--
-- Step 1: tipos_ajuste table (T006)
CREATE TABLE IF NOT EXISTS tipos_ajuste (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT         UNIQUE NOT NULL,
  activo     BOOLEAN      NOT NULL DEFAULT true,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO tipos_ajuste (nombre)
VALUES
  ('Bono por Horas Extras'),
  ('Bono por Transporte'),
  ('Estipendio'),
  ('Descuento')
ON CONFLICT (nombre) DO NOTHING;

-- Step 2: tipos_periodo_pago table (T007)
CREATE TABLE IF NOT EXISTS tipos_periodo_pago (
  codigo  VARCHAR(20)  PRIMARY KEY,
  nombre  TEXT         NOT NULL,
  activo  BOOLEAN      NOT NULL DEFAULT true
);

INSERT INTO tipos_periodo_pago (codigo, nombre)
VALUES
  ('SEMANAL',   'Semanal'),
  ('QUINCENAL', 'Quincenal'),
  ('MENSUAL',   'Mensual')
ON CONFLICT (codigo) DO NOTHING;

-- Step 3: Add ajuste_tipo_id FK to liquidacion_jornada (T008)
ALTER TABLE liquidacion_jornada
  ADD COLUMN IF NOT EXISTS ajuste_tipo_id UUID REFERENCES tipos_ajuste(id) ON DELETE SET NULL;

-- Step 4: Migrate existing enum data to FK (T009)
-- Maps TipoAjusteDia enum values to tipos_ajuste IDs
UPDATE liquidacion_jornada
SET ajuste_tipo_id = (
  SELECT id FROM tipos_ajuste WHERE nombre = CASE ajuste_tipo::text
    WHEN 'BONO_HORAS_EXTRAS' THEN 'Bono por Horas Extras'
    WHEN 'BONO_TRANSPORTE'   THEN 'Bono por Transporte'
    WHEN 'ESTIPENDIO'        THEN 'Estipendio'
    WHEN 'DESCUENTO'         THEN 'Descuento'
  END
)
WHERE ajuste_tipo IS NOT NULL
  AND ajuste_tipo_id IS NULL;

-- Verification queries (run to confirm migration):
-- SELECT COUNT(*) FROM tipos_ajuste;           -- expected: 4
-- SELECT COUNT(*) FROM tipos_periodo_pago;     -- expected: 3
-- SELECT ajuste_tipo, ajuste_tipo_id FROM liquidacion_jornada WHERE ajuste_tipo IS NOT NULL;
