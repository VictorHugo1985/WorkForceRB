# Data Model: Weekly Payroll Planilla

**Feature**: 016-payroll-planilla | **Date**: 2026-06-01

## Overview

The planilla is a **read-assembled view** — no new tables are required. It composes data from existing tables. The only new persistence surface is the existing `marcaciones_excluidas JSONB` column (added by feature 015) and the existing `estado` / `aprobado_por` / `aprobada_en` columns on `liquidaciones_semanales`.

---

## Existing Entities Used

### semanas_laborales

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| fecha_inicio | DATE | Week start |
| fecha_fin | DATE | Week end |
| estado | TEXT | ABIERTA / CERRADA |
| creado_en | TIMESTAMPTZ | |

**Used by planilla**: week selector dropdown.

---

### liquidaciones_semanales

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| semana_id | UUID FK → semanas_laborales | |
| colaborador_id | UUID FK → colaboradores | |
| estado | TEXT | BORRADOR / APROBADO |
| horas_ordinarias | NUMERIC | |
| horas_extra | NUMERIC | |
| valor_horas_ordinarias | NUMERIC | |
| valor_horas_extra | NUMERIC | |
| total_bonos | NUMERIC | |
| total_descuentos | NUMERIC | |
| total_pago | NUMERIC | Summary row total payment |
| calculado_en | TIMESTAMPTZ | |
| aprobado_por | UUID FK → usuarios | Null until confirmed |
| aprobada_en | TIMESTAMPTZ | Null until confirmed |

**State transitions**:
```
BORRADOR → APROBADO  (via POST /api/liquidaciones/[id]/aprobar)
```
Once APROBADO, the entire collaborator block is read-only in the planilla.

---

### dias_liquidacion

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| liquidacion_id | UUID FK → liquidaciones_semanales | |
| fecha | DATE | The worked day |
| horas_calculadas | NUMERIC | Auto-computed from biometric pairs |
| horas_ajustadas_supervisor | NUMERIC | Null unless manually adjusted |
| estado_dia | TEXT | SIN_REVISION / APROBADO / AJUSTADO |
| motivo_ajuste | TEXT | Required if horas_ajustadas_supervisor set |
| descuento_tipo | TEXT | TARIFA_DIA / MONTO_FIJO / null |
| descuento_valor | NUMERIC | |
| descuento_motivo | TEXT | |
| marcaciones_excluidas | JSONB | Array of excluded punch ISO strings (feature 015) |
| atraso_detectado | BOOLEAN | |

**Planilla display logic**:
- Displayed hours = `horas_ajustadas_supervisor ?? horasParejadas ?? horas_calculadas`
- `horasParejadas` is computed at read time from `eventos_biometricos_desglosados` via `buildJornadas()`
- If `horas_ajustadas_supervisor IS NOT NULL` → show "Ajustado" badge + original `horasParejadas` as reference
- If `tieneInconsistencia` (odd punch count) → show warning indicator on the row
- Inline edit is only available when `liquidacion.estado = 'BORRADOR'` and `dia.estado_dia ≠ 'APROBADO'`

---

### colaboradores

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| nombre | TEXT | |
| apellido | TEXT | |
| activo | BOOLEAN | Filter: only active collaborators |
| area_id | UUID FK → areas | |

---

### codigos_colaborador

| Column | Type | Notes |
|--------|------|-------|
| colaborador_id | UUID FK → colaboradores | |
| codigo_biometrico | TEXT | Maps device badge to collaborator |
| activo | BOOLEAN | |

**Used by planilla roster query**: JOIN to find biometric events per collaborator.

---

### eventos_biometricos_desglosados

| Column | Type | Notes |
|--------|------|-------|
| checktime | TIMESTAMPTZ | Punch timestamp |
| employee_workno | TEXT | Badge code (joins to codigos_colaborador) |

**Used by planilla roster query**: determines which collaborators have punches in the week (FR-001), and computes `maxShifts` (FR-002).

---

## Planilla Roster Query (conceptual)

```sql
-- Phase 1: count punches per collaborator per day in the week
WITH punched AS (
  SELECT cc.colaborador_id,
         ebd.checktime::date AS fecha,
         COUNT(*) AS punches
  FROM eventos_biometricos_desglosados ebd
  JOIN codigos_colaborador cc
       ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
  JOIN semanas_laborales sl ON sl.id = $1
       AND ebd.checktime::date BETWEEN sl.fecha_inicio AND sl.fecha_fin
  GROUP BY cc.colaborador_id, ebd.checktime::date
),
-- Phase 2: max punches per day per collaborator → max shifts for that collaborator
colab_max AS (
  SELECT colaborador_id,
         CEIL(MAX(punches)::numeric / 2)::int AS max_shifts
  FROM punched
  GROUP BY colaborador_id
)
SELECT
  ls.id              AS liquidacion_id,
  ls.colaborador_id,
  ls.estado,
  c.nombre || ' ' || c.apellido AS nombre,
  cm.max_shifts
FROM liquidaciones_semanales ls
JOIN colaboradores c   ON c.id = ls.colaborador_id
JOIN colab_max cm      ON cm.colaborador_id = ls.colaborador_id
WHERE ls.semana_id = $1
ORDER BY c.apellido, c.nombre
```

The week-global `maxShifts = MAX(cm.max_shifts)` across all rows drives the ENT/SAL column count for the planilla table.

---

## No Schema Changes Required

Feature 016 requires no DDL migrations. All needed columns exist:
- `dias_liquidacion.marcaciones_excluidas` — added by feature 015
- `liquidaciones_semanales.aprobado_por` / `aprobada_en` — existed before feature 016
- `liquidaciones_semanales.estado` APROBADO transition — handled by existing `/aprobar` route
