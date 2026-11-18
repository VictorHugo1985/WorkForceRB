-- Replace TipoAjusteDia enum: remove BONO_FIJO, add BONO_TRANSPORTE and ESTIPENDIO.
-- New values: BONO_HORAS_EXTRAS, BONO_TRANSPORTE, ESTIPENDIO, DESCUENTO

ALTER TYPE "TipoAjusteDia" RENAME TO "TipoAjusteDia_old";

CREATE TYPE "TipoAjusteDia" AS ENUM (
  'BONO_HORAS_EXTRAS',
  'BONO_TRANSPORTE',
  'ESTIPENDIO',
  'DESCUENTO'
);

ALTER TABLE dias_liquidacion
  ALTER COLUMN ajuste_tipo TYPE "TipoAjusteDia"
  USING ajuste_tipo::text::"TipoAjusteDia";

DROP TYPE "TipoAjusteDia_old";
