# Implementation Plan: Attendance Dashboard

**Branch**: `018-attendance-dashboard` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-attendance-dashboard/spec.md`

## Summary

Supervisory attendance dashboard showing today's attendance by area at a glance, with date-range filters, collaborador search, and per-area collapsible cards. The core implementation is **already complete** (shipped with `017-period-date-marcacion-calc`). One outstanding item must be addressed for constitutional compliance: 60-second auto-refresh on the "Hoy" view (Constitution Principle X).

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: Next.js 14 (App Router), MUI v5 (Material UI + Emotion), Zustand (not used by this feature — stateless), PostgreSQL via `pool` (direct queries, no ORM layer on Next.js side)

**Storage**: PostgreSQL — read-only queries over `colaboradores`, `areas`, `eventos_biometricos_desglosados`, `codigos_colaborador`

**Testing**: TypeScript compiler (`tsc --noEmit`) as primary correctness gate; no automated test suite for Next.js routes at this time

**Target Platform**: Web browser (desktop primary, mobile responsive)

**Project Type**: Web application (Next.js monorepo — `apps/web`)

**Performance Goals**: Dashboard load ≤3 seconds for 200 collaboradores; filter update ≤3 seconds; today's view refreshes within 60 seconds of a new biometric event (Constitution X)

**Constraints**: Read-only; no writes; restricted to ADMINISTRADOR and SUPERVISOR roles; Bolivia UTC-4 timezone

**Scale/Scope**: ~200 active collaboradores, multiple areas, single-tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Arquitectura basada en datos | ✅ Pass | No new tables; purely a query over existing schema |
| II. Código limpio y modular | ✅ Pass | DashboardClient, AreaCard, ColaboradorRow are separate components with single responsibilities |
| III. Inmutabilidad del registro biométrico | ✅ Pass | Read-only; no writes to biometric records |
| IV. Cálculo determinístico | ✅ Pass | N/A — no calculations; presence = ≥1 marcacion |
| V. Reglas configurables | ✅ Pass | N/A — attendance display has no business rules |
| VI. Ciclo de pago semanal | ✅ Pass | N/A — attendance is independent of payroll cycle |
| VII. Integración biométrica | ✅ Pass | Reads from `eventos_biometricos_desglosados` which captures both webhook and CSV import paths |
| VIII. RBAC | ✅ Pass | API restricted to ADMINISTRADOR + SUPERVISOR; COLABORADOR personal view deferred to a future feature (see research.md) |
| IX. Trazabilidad | ✅ Pass | N/A — read-only |
| **X. Disponibilidad en tiempo real** | ⚠️ Partial | **GAP**: No auto-refresh on "Hoy" view. Must add 60-second polling interval. See Complexity Tracking below. |
| XI. Seguridad y protección | ✅ Pass | Auth via JWT cookie; HTTPS in production; no sensitive data leaks |

**Constitution gate result**: PASS with one required fix (Principle X — auto-refresh).

## Project Structure

### Documentation (this feature)

```text
specs/018-attendance-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # API contract
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
apps/web/src/
├── app/
│   ├── (app)/
│   │   └── dashboard/
│   │       ├── page.tsx                  ✅ Done — renders DashboardClient
│   │       └── DashboardClient.tsx       ⚠️ Needs auto-refresh patch
│   └── api/
│       └── dashboard/
│           └── asistencia/
│               └── route.ts              ✅ Done — GET endpoint
```

**Structure Decision**: All code lives in `apps/web` (Next.js). No backend (`apps/api`) changes needed — the dashboard uses Next.js API routes with a direct `pool` connection, consistent with the existing pattern for liquidaciones and eventos.

## Outstanding Work

### 1. Auto-refresh patch — `DashboardClient.tsx` (Required — Constitution X)

Add a `setInterval` that fires every 60 seconds when `quick === 'hoy'`:

- On each tick: re-fire the fetch with the current filter (today's date).
- The interval is initialized when `quick` becomes `'hoy'` and cleared when it changes away or the component unmounts.
- The interval does NOT run for Ayer, Esta semana, or custom range queries — only for the live "Hoy" view.
- No loading spinner on auto-refresh ticks (background refresh); loading spinner only on manual filter changes.

This is a small, self-contained change to `DashboardClient.tsx`. No backend changes required.

### 2. Verification

- Run `tsc --noEmit` after the patch.
- Manually verify: open dashboard → observe network tab → confirm fetch fires at ~60s intervals when on "Hoy" filter.
- Switch to "Ayer" → confirm interval stops.
- Switch back to "Hoy" → confirm interval resumes.

## Complexity Tracking

> Constitution X violation that must be justified or resolved:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Polling on "Hoy" view (60s interval) | Constitution X requires ≤60s latency for active attendance view | A manual refresh button alone does not satisfy the constitutional 60s requirement; SSE/WebSocket would be disproportionate infrastructure for a low-event-rate display |
