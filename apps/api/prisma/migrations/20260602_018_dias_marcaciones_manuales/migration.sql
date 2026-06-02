-- Migration: Add marcaciones_manuales to dias_liquidacion
-- Feature: 016 — payroll planilla
-- Rationale: supervisors need to add/correct biometric punch pairs per day;
--            storing them lets us recompute hours and display the edited jornadas
--            without touching the source biometric events.

ALTER TABLE dias_liquidacion
  ADD COLUMN marcaciones_manuales JSONB NULL;

COMMENT ON COLUMN dias_liquidacion.marcaciones_manuales IS
  'Supervisor-edited punch pairs: [{entrada:"HH:MM", salida:"HH:MM"}]. '
  'When present, overrides biometric jornadas for display and hour computation.';
