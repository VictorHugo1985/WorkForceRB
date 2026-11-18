-- Migration: Feature 008 — Payroll simplification
-- Rationale: Simplified scope removes grouped payroll rules (no overtime thresholds,
--            no multipliers, no bonus criteria). tarifa_hora moves to colaboradores
--            as a direct column; configuraciones_reglas is eliminated.

-- Step 1: Create plantillas_horario (before adding FK in colaboradores)
CREATE TABLE plantillas_horario (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  nombre                TEXT        NOT NULL,
  dias_laborables       TEXT[]      NOT NULL,
  hora_entrada_esperada TIME        NOT NULL,
  creado_por            UUID        NOT NULL REFERENCES usuarios(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plantillas_horario_pkey PRIMARY KEY (id),
  CONSTRAINT plantillas_horario_nombre_key UNIQUE (nombre)
);

-- Step 2: Add new columns to colaboradores
ALTER TABLE colaboradores
  ADD COLUMN tarifa_hora          DECIMAL(15,4),
  ADD COLUMN plantilla_horario_id UUID REFERENCES plantillas_horario(id) ON DELETE SET NULL;

-- Step 3: Migrate existing tarifa data from configuraciones_reglas → colaboradores.tarifa_hora
UPDATE colaboradores c
SET tarifa_hora = sub.valor
FROM (
  SELECT DISTINCT ON (colaborador_id) colaborador_id, valor
  FROM configuraciones_reglas
  WHERE tipo = 'TARIFA_HORA'
    AND aplica_a = 'COLABORADOR'
    AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
  ORDER BY colaborador_id, vigente_desde DESC
) sub
WHERE c.id = sub.colaborador_id;

-- Step 4: Drop configuraciones_reglas and its enum types
DROP TABLE IF EXISTS configuraciones_reglas;
DROP TYPE IF EXISTS "TipoConfiguracion";
DROP TYPE IF EXISTS "AplicaA";
