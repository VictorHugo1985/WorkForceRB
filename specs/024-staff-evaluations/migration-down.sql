-- Migration: 024-staff-evaluations (DOWN)
-- Run in Supabase SQL Editor. ¡Elimina todas las evaluaciones registradas!

BEGIN;

DROP TABLE IF EXISTS evaluacion_detalles;
DROP TABLE IF EXISTS evaluaciones;
DROP TABLE IF EXISTS criterios_evaluacion;

-- Los registros en registros_auditoria se conservan (la auditoría solo se agrega y nunca se borra).

COMMIT;
