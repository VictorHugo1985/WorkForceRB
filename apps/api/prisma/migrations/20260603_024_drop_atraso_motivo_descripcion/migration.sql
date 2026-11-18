-- Remove unused fields from dias_liquidacion.
-- atraso_detectado: lateness flag — never surfaced to users.
-- motivo_ajuste: free-text reason — replaced by typed TipoAjuste.
-- ajuste_descripcion: free-text description — removed alongside motivo.

ALTER TABLE dias_liquidacion
  DROP COLUMN IF EXISTS atraso_detectado,
  DROP COLUMN IF EXISTS motivo_ajuste,
  DROP COLUMN IF EXISTS ajuste_descripcion;
