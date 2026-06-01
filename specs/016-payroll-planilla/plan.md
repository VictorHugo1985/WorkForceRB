# Implementation Plan: Weekly Payroll Planilla

**Branch**: `016-payroll-planilla` | **Date**: 2026-06-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-payroll-planilla/spec.md`

## Summary

Replace the current collaborator-list view at `/liquidaciones` with a spreadsheet-style weekly planilla
that renders one `LiquidacionColaborador` block per collaborator with biometric activity in the selected
week. Each block shows per-day rows with shift columns (ENT.1/SAL.1…ENT.N/SAL.N), supports inline
hours adjustment without dialogs, and includes a per-collaborator confirmation button. No new DB
schema is required — the view is assembled from existing `dias_liquidacion`, `liquidaciones_semanales`,
`colaboradores`, and `eventos_biometricos_desglosados` data.

## Technical Context

**Language/Version**: TypeScript 5 / Node.js 20

**Primary Dependencies**: Next.js 14 (App Router), MUI v6, Zod v4, pg (direct SQL — no ORM in web layer)

**Storage**: PostgreSQL via Supabase (session pooler); connection pool via `apps/web/src/lib/auth-server.ts`

**Testing**: No new automated tests (planilla is a UI feature; contract testing deferred per project norm)

**Target Platform**: Web — Next.js deployed on Vercel; all new API routes are Next.js Route Handlers

**Project Type**: Web application — Next.js 14 monorepo (`apps/web`)

**Performance Goals**: SC-004 — planilla loads fully for 30 collaborators in under 4 seconds (each
`LiquidacionColaborador` loads independently; roster endpoint < 500ms)

**Constraints**:
- Zero new DB migrations
- Auth via existing `checkLiquidacionRole` — no new auth mechanism
- MUI v6 API: `slotProps={{ htmlInput: ... }}` (not `inputProps`); Zod v4 `z.number()` (no `invalid_type_error`)
- All API routes under `apps/web/src/app/api/` — no `apps/api` (NestJS) changes

**Scale/Scope**: Up to 30 collaborators × 7 days; dynamic ENT/SAL columns up to max shifts in week

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Architecture Data-First | ✅ PASS | No new tables. Planilla is a computed view only. |
| II. Clean Code + OCP | ✅ PASS | New components extend existing patterns; `page.tsx` replaced, not mutated inline. |
| III. Biometric Immutability | ✅ PASS | `buildJornadas` reads punches read-only; no punch writes. |
| IV. Deterministic Audit | ✅ PASS | Inline edit calls existing PATCH which recalculates and stores motivo. |
| V. Configurable Rules | ✅ PASS | `tarifa_hora` read from DB per collaborator; no hardcoded values. |
| VI. Weekly Cycle as Primary Unit | ✅ PASS | Week selector respects existing `semanas_laborales`; default is most recent ABIERTA. |
| VII. Biometric Integration | N/A | Not touched by this feature. |
| VIII. RBAC | ✅ PASS | All new endpoints guarded by `checkLiquidacionRole` (ADMINISTRADOR + SUPERVISOR). Planilla page has auth guard in server component. |
| IX. Adjustment Traceability | ✅ PASS | Inline edit requires non-empty `motivoAjuste`; FR-008 enforced client-side and server validates via existing PATCH handler. |
| X. Real-time Attendance | N/A | Planilla shows liquidation data, not live attendance stream. |
| XI. Security & Data Protection | ✅ PASS | All routes auth-gated; no anonymous writes; HTTPS via Vercel. |

**Post-Phase 1 re-check**: No violations introduced by the design. Zero DDL migrations = zero schema
risk. All writes go through existing PATCH/POST handlers that already pass Constitution checks.

## Project Structure

### Documentation (this feature)

```text
specs/016-payroll-planilla/
├── plan.md              ← This file
├── research.md          ← Phase 0 output (completed)
├── data-model.md        ← Phase 1 output (completed)
├── contracts/
│   └── api.md           ← Phase 1 output (completed)
└── tasks.md             ← Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/web/src/
├── app/
│   ├── (app)/
│   │   └── liquidaciones/
│   │       ├── page.tsx                    ← REPLACE: thin server component (auth guard + render PlanillaView)
│   │       └── [semanaId]/[colaboradorId]/
│   │           └── page.tsx                ← UNCHANGED
│   └── api/
│       ├── planilla/
│       │   └── [semanaId]/
│       │       └── route.ts                ← NEW: GET roster endpoint
│       └── liquidaciones/
│           ├── [id]/
│           │   ├── route.ts                ← NEW: GET by liquidacion ID
│           │   └── aprobar/
│           │       └── route.ts            ← UNCHANGED
│           ├── resumen/route.ts            ← UNCHANGED (used elsewhere)
│           └── route.ts                   ← UNCHANGED
└── components/
    └── liquidaciones/
        ├── PlanillaView.tsx                ← NEW: week selector + roster fetch + renders blocks
        ├── LiquidacionColaborador.tsx      ← NEW: per-collaborator block (self-loading)
        ├── PlanillaDiaRow.tsx              ← NEW: one day row with shift columns + inline edit
        ├── InlineHorasCell.tsx             ← NEW: click-to-edit hours cell + motivo field
        ├── ConfirmarColaboradorButton.tsx  ← NEW: confirm button with inconsistency warning
        ├── LiquidacionesListClient.tsx     ← KEEP (no longer used by /liquidaciones but harmless)
        ├── LiquidacionDetailClient.tsx     ← UNCHANGED
        └── [other existing components]    ← UNCHANGED
```

**Structure Decision**: Web application monorepo (Option 2 variant). Only `apps/web` is touched. `apps/api`
(NestJS) requires no changes — all liquidacion logic already lives in `apps/web/src/lib/liquidacion-db.ts`.

## Implementation Notes

### New endpoint: GET /api/planilla/[semanaId]

Runs one SQL query using CTEs (see `data-model.md` — Planilla Roster Query) to:
1. Find all collaborators with ≥ 1 punch via `eventos_biometricos_desglosados` in the week range
2. Join to `liquidaciones_semanales` (create borradores lazily — NOT in this endpoint; `getLiquidacionDetail` handles that on first load)
3. Compute `maxShifts` = `MAX(CEIL(max_punches_per_day / 2))` across the week

**Note**: This endpoint returns only the roster (lightweight). It does NOT create borradores eagerly.
Each `LiquidacionColaborador` component creates its borrador on first load via `getLiquidacionDetail`.

**Auth**: Uses `checkLiquidacionRole` from `liquidacion-db.ts`.

### New endpoint: GET /api/liquidaciones/[id]

Looks up `colaborador_id` + `semana_id` from the `liquidaciones_semanales` record, then calls the
existing `getLiquidacionDetail(client, colaboradorId, semanaId)` which handles borrador creation,
biometric computation, self-correction, and full enrichment.

**Why**: Cleaner than passing both `colaborador_id` + `semana_id` as query params when the component
already knows the `liquidacionId` from the roster.

### PlanillaView component

State:
```typescript
selectedSemanaId: string | null
semanas: SemanaLaboral[]
roster: RosterEntry[]   // from GET /api/planilla/[semanaId]
maxShifts: number
loading: boolean
```

On `selectedSemanaId` change → fetch `/api/planilla/[semanaId]` → update `roster` + `maxShifts`.
On mount → fetch `/api/semanas-laborales` → set `semanas`; auto-select most recent ABIERTA.

### LiquidacionColaborador component

State:
```typescript
liquidacion: LiquidacionData | null
loading: boolean
locked: boolean   // true when estado === 'APROBADO'
showInconsistenciaWarning: boolean
```

On mount → fetch `GET /api/liquidaciones/[liquidacionId]` → store in local state.
`onDiaUpdate(updatedDia, updatedTotales)` → merge into local `liquidacion.dias[]` and update totals.
`onConfirmar()` → if any `tieneInconsistencia` days → set `showInconsistenciaWarning = true`; else POST.
After confirmation → `locked = true`.

### PlanillaDiaRow component

Renders:
- Date cell (formatted, e.g. "Lun 23/05")
- ENT.1, SAL.1, … ENT.N, SAL.N cells from `dia.jornadas[i].entrada/salida`
- Hours cell → `<InlineHorasCell>` if `!isReadOnly`, else read-only display
- Status indicators: "⚠" if `tieneInconsistencia`; "Ajustado" chip if `horasAjustadasSupervisor !== null`
- If adjusted: show original `horasParejadas` as greyed reference

### InlineHorasCell component

State:
```typescript
editing: boolean
draftHoras: string
draftMotivo: string
saving: boolean
error: string | null
```

Click on display → `editing = true`.
`onKeyDown`:
- Enter → if `draftMotivo.trim()` empty → set required error; else call `PATCH /api/dias-liquidacion/[id]`
- Escape → `editing = false`, restore original values.
`onBlur` (hours input) → do NOT auto-save on blur; only save on Enter (simpler, avoids focus-transfer race).

### ConfirmarColaboradorButton component

Props: `{ liquidacionId, hasInconsistencias, onConfirmed }`

State:
```typescript
showWarning: boolean
acknowledged: boolean
loading: boolean
```

If `!hasInconsistencias` → single click → POST `/api/liquidaciones/[id]/aprobar` → `onConfirmed()`.
If `hasInconsistencias` → first click → `showWarning = true` → render inline checkbox + second "Confirmar" button.
After checkbox checked + second click → POST.

### Week selector (inside PlanillaView)

Reuses same MUI `<Select>` pattern from `LiquidacionesListClient`. On change → update `selectedSemanaId`
in state (no router push — planilla is fully client-driven after initial page load).

### Column header (inside LiquidacionColaborador or PlanillaView)

Table header shows: Fecha | ENT.1 | SAL.1 | … | ENT.N | SAL.N | Horas | Estado
Column count determined by `maxShifts` prop passed down from `PlanillaView`.

### Empty state

If `roster.length === 0` after load → show `<Typography>No hay registros de asistencia para esta semana.</Typography>`

### Replacing page.tsx

The existing `apps/web/src/app/(app)/liquidaciones/page.tsx` server component fetches all active
collaborators + their liquidacion status. Replace it with a thin auth-guard-only server component that
renders `<PlanillaView />`. No initial data props needed — `PlanillaView` fetches everything client-side.

```typescript
// apps/web/src/app/(app)/liquidaciones/page.tsx (new version)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted } from '@/lib/auth-server';
import { PlanillaView } from '@/components/liquidaciones/PlanillaView';

export default async function LiquidacionesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');
  try {
    const payload = await verifyToken(token!);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
  } catch {
    redirect('/login?reason=expired');
  }
  return <PlanillaView />;
}
```

## Complexity Tracking

No Constitution Check violations. No complexity justifications required.
