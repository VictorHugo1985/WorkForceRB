# Implementation Plan: Eliminar Período de Liquidación

**Branch**: `020-delete-periodo-liquidacion` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/020-delete-periodo-liquidacion/spec.md`

---

## Summary

Add a delete action to the liquidation periods list so ADMINISTRADOR can remove periods that were created by mistake. Deletion is only allowed for ABIERTA periods with no APROBADO or PAGADO liquidaciones. All dependent BORRADOR records (dias_liquidacion, liquidacion_colaborador, bonos) are deleted in cascade within a single transaction. The change touches one API route file and one frontend component — no schema migration needed.

---

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS), PostgreSQL

**Primary Dependencies**: Next.js 14 App Router, MUI v5, `pg` (direct pool), `checkAdminRole` from `@/lib/auth-server`

**Storage**: PostgreSQL — no schema changes; DELETE on existing tables in transaction order

**Testing**: Manual smoke test + `tsc --noEmit`

**Target Platform**: `apps/web` (Next.js API route + React client component)

**Project Type**: Web application (monorepo: `apps/web`)

**Performance Goals**: Deletion of a period with up to ~200 collaborators × 7 days = ~1400 `dias_liquidacion` rows. Single transaction, negligible cost.

**Constraints**: Must be atomic — no partial deletes. Must not allow deletion of CERRADA periods or periods with APROBADO/PAGADO liquidaciones under any circumstance.

**Scale/Scope**: ~200 active collaborators, handful of open periods

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Arquitectura Basada en Datos | ✅ Pass | No schema changes; deletion within existing model |
| II. Código Limpio y Crecimiento Modular | ✅ Pass | DELETE handler added to existing route; UI follows established IconButton + Dialog pattern |
| IV. Cálculo Determinístico y Auditable | ✅ Pass | Only BORRADOR liquidaciones deleted; APROBADO/PAGADO are blocked |
| VIII. RBAC | ✅ Pass | `checkAdminRole` enforces ADMINISTRADOR-only; `isAdmin` prop gates UI button |
| IX. Trazabilidad Obligatoria | ✅ Pass | `registros_auditoria` entry created on every successful delete |
| XI. Seguridad y Protección de Datos | ✅ Pass | All writes protected by session auth; transaction ensures no partial state |

**Gate result: PASS** — no violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/020-delete-periodo-liquidacion/
├── plan.md              ← this file
├── research.md          ← Phase 0 output ✅
├── data-model.md        ← Phase 1 output ✅
├── quickstart.md        ← Phase 1 output ✅
├── contracts/
│   └── api.md           ← Phase 1 output ✅
└── tasks.md             ← Phase 2 output (from /speckit-tasks)
```

### Source Code — affected files

```text
apps/web/src/app/api/semanas-laborales/[id]/route.ts   ← add DELETE handler
apps/web/src/components/semanas/SemanasListClient.tsx   ← add delete button + dialog
```

**Structure Decision**: Option 2 (Web application). Two files, both in `apps/web`.

---

## Phase 0: Research Summary

See `research.md` for full decisions.

**Decision 1 — Auth guard**: `checkAdminRole` (from `@/lib/auth-server`). Deletion is admin-only; `checkLiquidacionRole` was rejected because it permits SUPERVISOR.

**Decision 2 — Cascade strategy**: Application-level transaction. Delete in order: `dias_liquidacion` → `liquidacion_colaborador` → `bonos` → `liquidacion_periodo`. No schema migration required.

**Decision 3 — API route**: `DELETE` handler added to the existing `[id]/route.ts` file alongside the existing `GET` and `PATCH` handlers.

**Decision 4 — UI**: `DeleteIcon` IconButton in the actions column, visible only when `isAdmin && s.estado === 'ABIERTA'`. Confirmation Dialog reuses the existing MUI Dialog pattern in the same component.

**Decision 5 — Eligibility check**: Server-side only. The UI hides the button for CERRADA periods as a convenience, but the server is authoritative and always re-validates.

---

## Phase 1: Design & Contracts

### Data Model

See `data-model.md`.

**No schema changes.** Deletion order within transaction:

```sql
DELETE FROM dias_liquidacion
WHERE liquidacion_id IN (SELECT id FROM liquidacion_colaborador WHERE semana_id = $1);

DELETE FROM liquidacion_colaborador WHERE semana_id = $1;

DELETE FROM bonos WHERE semana_id = $1;

DELETE FROM liquidacion_periodo WHERE id = $1;
```

Eligibility gate (checked before deletes):

```sql
SELECT COUNT(*) FROM liquidacion_colaborador
WHERE semana_id = $1 AND estado IN ('APROBADO', 'PAGADO');
-- Must be 0 to proceed
```

### Interface Contracts

See `contracts/api.md`.

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/semanas-laborales/[id]` | `DELETE` | **New** — admin-only; 200 on success, 409 if blocked, 422 if CERRADA |

### Agent Context

CLAUDE.md updated to point to `specs/020-delete-periodo-liquidacion/plan.md` ✅

---

## Complexity Tracking

> No constitution violations — section intentionally empty.
