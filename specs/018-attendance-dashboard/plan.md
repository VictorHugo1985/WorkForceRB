# Implementation Plan: Attendance Dashboard — FR-015 Arrival-Order Sort

**Branch**: `018-attendance-dashboard` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-attendance-dashboard/spec.md`

---

## Summary

The core dashboard (FR-001–FR-014) is fully implemented and shipped. This plan covers **FR-015** only: sorting collaborators within each area card by their first marcacion time in single-day view (earliest arrival first), with absent collaborators at the end sorted alphabetically. Multi-day view retains existing alphabetical ordering.

---

## Technical Context

**Language/Version**: TypeScript (Node.js 22 LTS)

**Primary Dependencies**: Next.js 14 App Router, MUI v5, Axios, pg (direct pool)

**Storage**: PostgreSQL via direct pool (`@/lib/auth-server` pool) — no Prisma in Next.js API routes

**Testing**: Manual smoke test + `tsc --noEmit`

**Target Platform**: Next.js API route (`apps/web/src/app/api/dashboard/asistencia/route.ts`)

**Project Type**: Web application (Next.js 14 monorepo, `apps/web` + `apps/api`)

**Performance Goals**: ≤3s for 200 collaboradores (SC-002, unchanged — only JS sort added post-query)

**Constraints**: Bolivia UTC-4, marcaciones already ordered by `checktime` ASC in SQL CTE — no extra query cost

**Scale/Scope**: ~200 active collaboradores, read-only feature

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Arquitectura Basada en Datos | ✅ Pass | No schema changes; read-only sort |
| II. Código Limpio y Crecimiento Modular | ✅ Pass | Sort added as isolated post-processing step |
| III. Inmutabilidad del Registro Biométrico | ✅ Pass | No writes |
| IV. Cálculo Determinístico y Auditable | ✅ Pass | Sort is deterministic: same data → same order |
| VIII. RBAC | ✅ Pass | No role changes |
| X. Disponibilidad en Tiempo Real | ✅ Pass | Auto-refresh already in place; sort is client-transparent |
| XI. Seguridad y Protección de Datos | ✅ Pass | No new endpoints or auth changes |

**Gate result: PASS** — no violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/018-attendance-dashboard/
├── plan.md              ← this file
├── research.md          ← Phase 0 output (updated with Decision 5)
├── data-model.md        ← Phase 1 output (updated with FR-015 sort pattern)
├── quickstart.md        ← Phase 1 output (existing, unchanged)
├── contracts/
│   └── api.md           ← Phase 1 output (updated with ordering semantics)
└── tasks.md             ← Phase 2 output (to be updated by /speckit-tasks)
```

### Source Code (repository root — affected files only)

```text
apps/web/src/app/api/dashboard/asistencia/
└── route.ts             ← sole change: add JS sort after areaMap construction
```

No frontend changes. No SQL changes. No migration needed.

**Structure Decision**: Option 2 (Web application) with `apps/web` + `apps/api`. Only `apps/web/src/app/api/dashboard/asistencia/route.ts` is modified.

---

## Phase 0: Research Summary

All research complete. See `research.md` for full decisions. Decision 5 (added) covers FR-015.

**Decision 5 — Where to implement arrival-order sort**:

- **Decision**: JS post-processing in the API route, after `areaMap` construction.
- **Rationale**: The SQL CTE already orders `marcaciones` by `checktime ASC` (via `ORDER BY ebd.checktime`), so `dias[0].marcaciones[0]` reliably holds the earliest punch of the day. A JS sort on the array requires zero SQL changes and keeps the query unchanged. Sorting in SQL would require conditional `ORDER BY` logic or a subquery for the "first punch per colaborador" — unnecessary complexity.
- **Single-day sort key**: `dias[0]?.marcaciones[0]` — an `"HH:MM"` string. `String.prototype.localeCompare` / `<` comparison is safe because the format is fixed-width 24-hour.
- **Multi-day**: SQL already returns `ORDER BY c.apellido, c.nombre`. No re-sort needed.
- **Alternatives considered**: SQL-level sort (rejected — conditional ORDER BY adds complexity for no gain); frontend sort in `AreaCard` (rejected — API is the contract boundary; response ordering should be correct at the source).

---

## Phase 1: Design & Contracts

### Data Model (FR-015 addition)

No table or schema changes. The existing query pattern is sufficient. See `data-model.md` for the updated Query Pattern section documenting the JS sort step.

**Sort algorithm** (added to API route after `areaMap` loop):

```typescript
const isSingleDay = fechaDesde === fechaHasta;

if (isSingleDay) {
  for (const area of areaMap.values()) {
    area.colaboradores.sort((a, b) => {
      const aTime = (a as ColaboradorRow).dias[0]?.marcaciones[0];
      const bTime = (b as ColaboradorRow).dias[0]?.marcaciones[0];
      if (aTime && bTime) return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
      if (aTime) return -1;   // present before absent
      if (bTime) return 1;
      // Both absent: alphabetical by apellido then nombre
      const aName = `${(a as ColaboradorRow).apellido} ${(a as ColaboradorRow).nombre}`;
      const bName = `${(b as ColaboradorRow).apellido} ${(b as ColaboradorRow).nombre}`;
      return aName.localeCompare(bName, 'es');
    });
  }
}
```

### Interface Contract (updated)

`GET /api/dashboard/asistencia` — response semantics updated in `contracts/api.md`:
- **Single-day**: `colaboradores` within each area ordered by first marcacion time ascending; absent collaboradores appear at end, alphabetical by apellido.
- **Multi-day**: `colaboradores` ordered by `apellido, nombre` (SQL).

### Agent Context

CLAUDE.md already points to `specs/018-attendance-dashboard/plan.md` — no update needed.

---

## Complexity Tracking

> No constitution violations — section intentionally empty.
