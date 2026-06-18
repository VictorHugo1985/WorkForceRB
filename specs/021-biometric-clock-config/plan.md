# Implementation Plan: Configuración de Relojes Biométricos

**Branch**: `021-biometric-clock-config` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-biometric-clock-config/spec.md`

---

## Summary

Add a "Configuración Reloj" entry to the sidebar (ADMINISTRADOR only) pointing to a new `/relojes` page. The page lists all biometric devices (active and inactive) and lets the admin register new ones, edit existing ones, and toggle their active state. The `dispositivos_biometricos` table already has all required columns — no schema migration needed. The feature touches 6 files: nav config, sidebar icons, two API routes (extended GET + POST + new PATCH), a new server page, and a new client component.

---

## Technical Context

**Language/Version**: TypeScript (Node.js 20 LTS), PostgreSQL

**Primary Dependencies**: Next.js 14 App Router, MUI v5, `pg` (direct pool), `checkAdminRole` from `@/lib/auth-server`, Zod for request validation

**Storage**: PostgreSQL — no schema changes; all operations on existing `dispositivos_biometricos` table

**Testing**: Manual smoke test + `tsc --noEmit`

**Target Platform**: `apps/web` (Next.js API routes + React client component)

**Project Type**: Web application (monorepo: `apps/web`)

**Performance Goals**: List of ~10–20 devices; trivial query cost.

**Constraints**: `webhook_secreto` must never appear in API responses. The field is stored as plaintext in the DB (already designed this way); this feature manages the data but does not change the webhook validation logic. Deletion is not allowed (FK constraints from `codigos_colaborador` and `eventos_biometricos`).

**Scale/Scope**: 10–20 biometric devices max in production.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Arquitectura Basada en Datos | ✅ Pass | No schema changes; existing `dispositivos_biometricos` table used as-is |
| II. Código Limpio y Crecimiento Modular | ✅ Pass | New page + component follow established pattern; minimal changes to existing files |
| III. Inmutabilidad del Registro Biométrico | ✅ Pass | This feature manages device config, not biometric events |
| VII. Integración con Medios Biométricos | ✅ Pass | Manages WEBHOOK + CSV device metadata; does not change event processing |
| VIII. RBAC | ✅ Pass | All endpoints behind `checkAdminRole`; sidebar item filtered by ADMINISTRADOR role |
| IX. Trazabilidad Obligatoria | ✅ Pass | `registros_auditoria` entry on every create, edit, and state change |
| XI. Seguridad y Protección de Datos | ✅ Pass | `webhook_secreto` never returned in API responses; guarded by session auth |

**Gate result: PASS** — no violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/021-biometric-clock-config/
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
apps/web/src/lib/nav-config.ts                          ← add /relojes entry
apps/web/src/components/layout/AppSidebar.tsx            ← add AccessTimeIcon for /relojes
apps/web/src/app/api/dispositivos/route.ts               ← extend GET + add POST
apps/web/src/app/api/dispositivos/[id]/route.ts          ← NEW: PATCH handler
apps/web/src/app/(app)/relojes/page.tsx                  ← NEW: server page
apps/web/src/components/relojes/RelojesListClient.tsx     ← NEW: client component
```

**Structure Decision**: Option 2 (Web application). All changes in `apps/web`.

---

## Phase 0: Research Summary

See `research.md` for full decisions.

**Decision 1 — Route path**: `/relojes` (new sidebar item, separate from existing `/configuracion`).

**Decision 2 — Webhook secret**: Stored as plaintext in DB (existing design). Never returned in GET responses — return `tiene_webhook_secreto: boolean` instead. On edit, empty/omitted value keeps the existing secret; a non-empty value replaces it. Changing `tipo` from WEBHOOK to CSV clears the secret.

**Decision 3 — API structure**: Extend existing `GET /api/dispositivos` (all devices + all fields) and add `POST`. New `apps/web/src/app/api/dispositivos/[id]/route.ts` for `PATCH`. Existing collaborator form consumers are unaffected (they only use `id` and `nombre`).

**Decision 4 — UI component**: `RelojesListClient.tsx` — list + inline create dialog + edit dialog + toggle active. Follows the established `*ListClient.tsx` pattern.

**Decision 5 — Sidebar icon**: `AccessTimeIcon` from `@mui/icons-material` (clock icon for "reloj").

**Decision 6 — No migration**: `dispositivos_biometricos` already has all fields.

---

## Phase 1: Design & Contracts

### Data Model

See `data-model.md`.

**No schema changes.** All CRUD on existing `dispositivos_biometricos` table. Key constraints:
- `webhook_secreto`: never returned in API responses
- `numero_serie`: unique across all devices (active + inactive) if provided
- Audit: `registros_auditoria` entry on every write

### Interface Contracts

See `contracts/api.md`.

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/dispositivos` | `GET` | **Modified** — returns all devices + all fields (was: active only, 3 fields) |
| `/api/dispositivos` | `POST` | **New** — create device |
| `/api/dispositivos/[id]` | `PATCH` | **New** — edit / toggle active |

### Agent Context

CLAUDE.md updated to point to `specs/021-biometric-clock-config/plan.md` ✅

---

## Complexity Tracking

> No constitution violations — section intentionally empty.
