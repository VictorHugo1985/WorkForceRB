# Data Model: Gestión de Parámetros de Configuración

**Feature**: 022-config-crud-params | **Date**: 2026-06-18

---

## Existing Table: `areas`

**No schema changes** — already complete.

```sql
areas (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT         UNIQUE NOT NULL,
  activo     BOOLEAN      NOT NULL DEFAULT true,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
)
```

**Referenced by**: `colaboradores.area_id FK NULLABLE`

**Business rules**:
- `nombre` must be unique (case-sensitive at DB level; app will normalize to trim whitespace)
- Cannot delete if any `colaboradores.area_id = this.id` exists
- Cannot deactivate the last active area (guard: `COUNT(*) WHERE activo=true AND id != $1 = 0` → 422)
- Inactivating does not cascade to collaborators — they retain their area assignment

---

## New Table: `tipos_ajuste`

**Created by migration** in Supabase. Seeds 4 values from the existing `TipoAjusteDia` enum.

```sql
tipos_ajuste (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT         UNIQUE NOT NULL,
  activo     BOOLEAN      NOT NULL DEFAULT true,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
)
```

**Seed data** (from enum migration):

| nombre | activo |
|--------|--------|
| Bono por Horas Extras | true |
| Bono por Transporte | true |
| Estipendio | true |
| Descuento | true |

**Referenced by**: `liquidacion_jornada.ajuste_tipo_id UUID FK NULLABLE`

**Business rules**:
- `nombre` must be unique
- Cannot delete if any `liquidacion_jornada.ajuste_tipo_id = this.id` exists
- Cannot deactivate the last active tipo (guard: same pattern as áreas)
- Inactivation preserves historical records — existing `liquidacion_jornada` rows retain their FK reference

---

## New Column: `liquidacion_jornada.ajuste_tipo_id`

**Added by migration** as nullable FK.

```sql
ALTER TABLE liquidacion_jornada
  ADD COLUMN ajuste_tipo_id UUID REFERENCES tipos_ajuste(id) ON DELETE SET NULL;
```

- `ajuste_tipo` (enum column `TipoAjusteDia`) remains — deprecated, not removed in this feature
- 1 existing record migrated: enum value mapped to the corresponding `tipos_ajuste.id`
- New adjustments use `ajuste_tipo_id`; `ajuste_tipo` set to NULL for new records

---

## New Table: `tipos_periodo_pago`

**Created by migration**. Config-only — no FK from `colaboradores`.

```sql
tipos_periodo_pago (
  codigo  VARCHAR(20)  PRIMARY KEY,
  nombre  TEXT         NOT NULL,
  activo  BOOLEAN      NOT NULL DEFAULT true
)
```

**Seed data** (matches `TipoPeriodoPago` enum values):

| codigo | nombre | activo |
|--------|--------|--------|
| SEMANAL | Semanal | true |
| QUINCENAL | Quincenal | true |
| MENSUAL | Mensual | true |

**Referenced by**: nothing (decoupled from `colaboradores.tipo_pago` enum in this feature)

**Business rules**:
- Cannot deactivate the last active tipo (guard as above → 422)
- No create or delete in this feature — only PATCH `activo`
- `colaboradores.tipo_pago` continues using the `TipoPeriodoPago` enum directly

---

## Entity Relationships

```
areas ──────────────── colaboradores.area_id (nullable FK)
                        → inactivation: allowed, cascades only to selector filter
                        → deletion: blocked if any collaborator references it

tipos_ajuste ────────── liquidacion_jornada.ajuste_tipo_id (nullable FK, ON DELETE SET NULL)
                        → deletion: blocked if any liquidacion_jornada row references it
                        → inactivation: allowed, preserves historical FK values

tipos_periodo_pago ─── (no FK — decoupled config only)
                        → TipoPeriodoPago enum on colaboradores.tipo_pago is independent
```

---

## State Transitions

### `areas.activo` / `tipos_ajuste.activo` / `tipos_periodo_pago.activo`

```
true ──[PATCH activo=false]──► false
  ^                               │
  └──[PATCH activo=true]──────────┘
```

Blocked transitions:
- `true → false` when this is the last active item (422)
- `tipos_periodo_pago`: no transition possible when only 1 remains active

### `areas` / `tipos_ajuste` deletion

```
(exists) ──[DELETE, if no references]──► (deleted)
         ──[DELETE, with references]───► 422 UNPROCESSABLE
```
