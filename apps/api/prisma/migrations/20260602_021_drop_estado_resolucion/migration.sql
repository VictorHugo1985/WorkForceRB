-- Remove estado_resolucion from eventos_biometricos.
-- All events were stored as SIN_RESOLVER; resolution state was never updated,
-- making the column noise. Resolution is derived at query time from related tables.

ALTER TABLE eventos_biometricos DROP COLUMN IF EXISTS estado_resolucion;
DROP TYPE IF EXISTS "EstadoResolucion";
