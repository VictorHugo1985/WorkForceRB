-- Migration: 024-staff-evaluations (UP)
-- Run in Supabase SQL Editor
-- Date: 2026-11-18
-- Reversal: migration-down.sql

BEGIN;

-- 1. Catálogo de criterios ponderados
CREATE TABLE IF NOT EXISTS criterios_evaluacion (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(100)  NOT NULL,
  descripcion     TEXT,
  peso            NUMERIC(5,2)  NOT NULL CHECK (peso > 0 AND peso <= 100),
  activo          BOOLEAN       NOT NULL DEFAULT true,
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_criterios_evaluacion_nombre_activo
  ON criterios_evaluacion (LOWER(nombre)) WHERE activo;

-- 2. Encabezado de evaluaciones
CREATE TABLE IF NOT EXISTS evaluaciones (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id    UUID          NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
  evaluador_id      UUID          NOT NULL REFERENCES usuarios(id),
  fecha_evaluacion  DATE          NOT NULL,
  puntaje_final     NUMERIC(4,2)  NOT NULL CHECK (puntaje_final BETWEEN 1 AND 10),
  comentario        TEXT,
  estado            VARCHAR(10)   NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE', 'ANULADA')),
  motivo_anulacion  TEXT,
  anulada_por       UUID          REFERENCES usuarios(id),
  anulada_en        TIMESTAMPTZ,
  creado_en         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT ck_evaluaciones_anulacion CHECK (
    (estado = 'VIGENTE' AND motivo_anulacion IS NULL AND anulada_por IS NULL AND anulada_en IS NULL)
    OR
    (estado = 'ANULADA' AND motivo_anulacion IS NOT NULL AND anulada_por IS NOT NULL AND anulada_en IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ix_evaluaciones_colaborador_fecha
  ON evaluaciones (colaborador_id, fecha_evaluacion DESC, creado_en DESC);

-- 3. Detalle por criterio (snapshot de nombre y peso)
CREATE TABLE IF NOT EXISTS evaluacion_detalles (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id    UUID          NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
  criterio_id      UUID          NOT NULL REFERENCES criterios_evaluacion(id) ON DELETE RESTRICT,
  criterio_nombre  VARCHAR(100)  NOT NULL,
  peso             NUMERIC(5,2)  NOT NULL,
  puntaje          SMALLINT      NOT NULL CHECK (puntaje BETWEEN 1 AND 10),
  CONSTRAINT ux_evaluacion_detalles_criterio UNIQUE (evaluacion_id, criterio_id)
);

-- 4. Criterios iniciales (suman 100%)
INSERT INTO criterios_evaluacion (nombre, peso)
SELECT v.nombre, v.peso
FROM (VALUES ('Puntualidad', 25.00), ('Orden', 25.00), ('Limpieza', 25.00), ('Respeto', 25.00)) AS v(nombre, peso)
WHERE NOT EXISTS (SELECT 1 FROM criterios_evaluacion);

COMMIT;
