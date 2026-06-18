# Implementation Plan: Tipo de Colaborador — Campo Fijo

**Branch**: `019-add-fijo-field` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-add-fijo-field/spec.md`

---

## Summary

Add a `fijo` boolean column to the `colaboradores` table. Collaborators marked `fijo = true` are salaried employees excluded from the hourly wage calculation (planilla). All other collaborators default to `fijo = false` (jornalero — current behavior). The change touches: one DB migration, two Prisma schemas, three API routes, and three frontend components.

---

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS), PostgreSQL

**Primary Dependencies**: Next.js 14 App Router, MUI v5, Zod, `pg` (direct pool), Prisma (schema + migrations)

**Storage**: PostgreSQL — add `fijo BOOLEAN NOT NULL DEFAULT false` to `colaboradores`

**Testing**: Manual smoke test + `tsc --noEmit`

**Target Platform**: `apps/web` (Next.js API routes + React components) + `packages/database` + `apps/api` (Prisma schemas)

**Project Type**: Web application (monorepo: `apps/web` + `apps/api` + `packages/database`)

**Performance Goals**: No new queries; existing queries gain one WHERE clause condition — negligible cost.

**Constraints**: Must not alter existing hourly calculations for jornalero collaborators. Migration must be reversible (DOWN = `DROP COLUMN fijo`).

**Scale/Scope**: ~200 active collaborators

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Arquitectura Basada en Datos | ✅ Pass | Schema change via formal migration; approved by spec governance |
| II. Código Limpio y Crecimiento Modular | ✅ Pass | Boolean column + WHERE clause — minimal footprint |
| IV. Cálculo Determinístico y Auditable | ✅ Pass | `fijo = true` → excluded deterministically; classification at calculation time |
| IX. Trazabilidad de Ajustes | ✅ Pass | `fijo` changes logged in `registros_auditoria` via existing PATCH audit block |
| XI. Seguridad y Protección de Datos | ✅ Pass | PATCH `/api/colaboradores/[id]` already uses `checkAdminRole`; no new auth surface |

**Gate result: PASS** — no violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/019-add-fijo-field/
├── plan.md              ← this file
├── research.md          ← Phase 0 output ✅
├── data-model.md        ← Phase 1 output ✅
├── quickstart.md        ← Phase 1 output ✅
├── contracts/
│   └── api.md           ← Phase 1 output ✅
└── tasks.md             ← Phase 2 output ✅
```

### Source Code — affected files

```text
packages/database/prisma/
└── schema.prisma                          ← add fijo Boolean @default(false) to Colaborador

apps/api/prisma/
├── schema.prisma                          ← same
└── migrations/
    └── 20260618_025_add_fijo_colaborador/
        └── migration.sql                  ← ALTER TABLE + DOWN comment

apps/web/src/app/api/
├── colaboradores/
│   ├── route.ts                           ← GET: add fijo to SELECT/response; POST: add to schema+INSERT
│   └── [id]/route.ts                      ← GET: add fijo; PATCH: add to EditSchema+UPDATE+audit
└── planilla/
    └── [semanaId]/route.ts                ← add AND c.fijo = false to roster SQL

apps/web/src/components/colaboradores/
├── RegistroWizard.tsx                     ← add fijo field (default false) to form state
├── steps/Step1DatosPersonales.tsx         ← add Fijo/Jornalero toggle
└── ColaboradorPerfil.tsx                  ← display fijo badge

apps/web/src/app/(app)/colaboradores/
└── ColaboradoresListClient.tsx            ← show fijo chip per row; add tipo filter
```

**Structure Decision**: Option 2 (Web application). Only `apps/web` and the two Prisma schemas require changes.

---

## Phase 0: Research Summary

See `research.md` for full decisions.

**Decision 1 — Migration format**: Raw SQL file, naming convention `YYYYMMDD_NNN_description/migration.sql`, consistent with the 24 existing migrations in `apps/api/prisma/migrations/`. The SQL is:
```sql
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS fijo BOOLEAN NOT NULL DEFAULT false;
-- DOWN: ALTER TABLE colaboradores DROP COLUMN fijo;
```

**Decision 2 — Exclusion point**: The `planilla/[semanaId]/route.ts` roster query is the single correct exclusion point. It already filters by `tipo_pago`; adding `AND c.fijo = false` to the WHERE clause on the `colaboradores` join is the minimal, deterministic change. The liquidacion detail routes are downstream — if a `fijo` collaborator never enters the planilla roster, they never get a `liquidacion_colaborador` row created.

**Decision 3 — UI widget for fijo toggle**: MUI `Switch` component in `Step1DatosPersonales` (registration wizard) and as a boolean field in the collaborator edit form (`ColaboradorPerfil`). Only renders as editable for ADMINISTRADOR (already enforced by `checkAdminRole` on the PATCH route).

**Decision 4 — List display**: MUI `Chip` (`"Fijo"` / `"Jornalero"`) in `ColaboradoresListClient`. Filter via a new chip toggle above the table (similar to the `activo` filter already present).

---

## Phase 1: Design & Contracts

### Data Model

See `data-model.md`.

**Schema diff** (both `packages/database` and `apps/api` Prisma schemas):

```prisma
model Colaborador {
  // ... existing fields ...
  fijo  Boolean  @default(false)   // ← new
  // ...
}
```

**Migration SQL** (`apps/api/prisma/migrations/20260618_025_add_fijo_colaborador/migration.sql`):

```sql
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS fijo BOOLEAN NOT NULL DEFAULT false;
```

No foreign keys. No indexes required. Default `false` applies retroactively to all existing rows — FR-008 satisfied.

### Interface Contracts

See `contracts/api.md`.

**Changed endpoints:**

| Endpoint | Change |
|----------|--------|
| `GET /api/colaboradores` | Add `fijo: boolean` to each item in response |
| `POST /api/colaboradores` | Accept optional `fijo: boolean` (default `false`) |
| `GET /api/colaboradores/[id]` | Add `fijo: boolean` to response |
| `PATCH /api/colaboradores/[id]` | Accept `fijo: boolean`; ADMINISTRADOR-only (no change to auth) |
| `GET /api/planilla/[semanaId]` | Implicit: `fijo = true` collaborators never appear in roster |

### Agent Context

CLAUDE.md points to `specs/019-add-fijo-field/plan.md` ✅

---

## Complexity Tracking

> No constitution violations — section intentionally empty.
