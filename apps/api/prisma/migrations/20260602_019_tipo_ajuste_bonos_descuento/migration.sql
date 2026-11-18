BEGIN;

-- Convert column to text to allow dropping the enum
ALTER TABLE dias_liquidacion
  ALTER COLUMN ajuste_tipo TYPE TEXT USING ajuste_tipo::TEXT;

-- Clear rows with old enum values (no data worth preserving)
UPDATE dias_liquidacion
SET ajuste_tipo = NULL, ajuste_valor = NULL, ajuste_descripcion = NULL
WHERE ajuste_tipo IN ('TARIFA_DIA', 'MONTO_FIJO');

DROP TYPE IF EXISTS "TipoAjusteDia";

CREATE TYPE "TipoAjusteDia" AS ENUM ('BONO_HORAS_EXTRAS', 'BONO_FIJO', 'DESCUENTO');

ALTER TABLE dias_liquidacion
  ALTER COLUMN ajuste_tipo TYPE "TipoAjusteDia"
    USING ajuste_tipo::"TipoAjusteDia";

COMMIT;
