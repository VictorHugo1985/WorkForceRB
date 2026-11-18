-- Migration: Add historico_tarifas_hora — one-to-many tarifa history per collaborator
-- Feature: 016 — payroll planilla
-- Rationale: collaborators can have different hourly rates over time;
--            a single tarifa_hora column on colaboradores cannot track this history.

CREATE TABLE historico_tarifas_hora (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID          NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  tarifa_hora    NUMERIC(15,4) NOT NULL CHECK (tarifa_hora > 0),
  vigente_desde  DATE          NOT NULL DEFAULT CURRENT_DATE,
  creado_por     UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_historico_tarifas_colaborador
  ON historico_tarifas_hora (colaborador_id, vigente_desde DESC, creado_en DESC);

-- Seed current tarifa into history for every collaborator that already has one
INSERT INTO historico_tarifas_hora (colaborador_id, tarifa_hora, vigente_desde, creado_en)
SELECT id, tarifa_hora, CURRENT_DATE, now()
FROM   colaboradores
WHERE  tarifa_hora IS NOT NULL;
