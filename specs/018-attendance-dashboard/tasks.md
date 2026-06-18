# Tasks: Attendance Dashboard

**Input**: Design documents from `specs/018-attendance-dashboard/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Status note**: The core implementation (T001–T030) was shipped in a prior session. All previous tasks are marked `[x]`. Phase 8 covers the new **FR-015** arrival-order sort added on 2026-06-18.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Routing and file structure for the dashboard.

- [x] T001 Create `apps/web/src/app/(app)/dashboard/page.tsx` as route entry point rendering `DashboardClient`
- [x] T002 Create `apps/web/src/app/api/dashboard/asistencia/route.ts` as GET endpoint skeleton with auth check

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data layer — SQL query and API response shape that all user stories consume.

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete.

- [x] T003 Implement CTE SQL query in `apps/web/src/app/api/dashboard/asistencia/route.ts`: join `eventos_biometricos_desglosados` → `codigos_colaborador` → `colaboradores` → `areas`, using `make_interval(hours => utc_offset)` for Bolivia local date filtering
- [x] T004 Add collaborador filter (partial ILIKE on nombre/apellido/cedula) to query in `apps/web/src/app/api/dashboard/asistencia/route.ts`
- [x] T005 Group query results by area in JS and return `{ fechaDesde, fechaHasta, areas: AreaData[] }` from `apps/web/src/app/api/dashboard/asistencia/route.ts`
- [x] T006 Restrict endpoint to ADMINISTRADOR and SUPERVISOR roles in `apps/web/src/app/api/dashboard/asistencia/route.ts`

**Checkpoint**: Foundation ready — GET `/api/dashboard/asistencia` returns correct grouped data ✅

---

## Phase 3: User Story 1 — Today's Attendance at a Glance (Priority: P1) 🎯 MVP

**Goal**: Dashboard loads today's attendance by default; supervisor sees present/absent counts and marcaciones per area with no extra navigation.

**Independent Test**: Open dashboard → without any filters, all active colaboradores appear grouped by area, with green/gray dots and today's punch times.

### Implementation for User Story 1

- [x] T007 [US1] Define TypeScript interfaces (`DiaData`, `ColaboradorData`, `AreaData`, `DashboardData`) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T008 [P] [US1] Implement `todayBolivia()` helper and `presenceColor()` function in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T009 [US1] Implement `ColaboradorRow` component (status dot, name, marcaciones chips) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T010 [US1] Implement `AreaCard` component (header, LinearProgress, attendance %, collapsible body) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T011 [US1] Implement summary banner (Presentes / Cobertura % / Ausentes) in `DashboardClient` in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T012 [US1] Implement initial load: fetch today on mount, render area cards grid in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T013 [US1] Add show/hide absent toggle (PersonOffIcon button) to `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`

**Checkpoint**: User Story 1 fully functional — today's attendance visible on dashboard load ✅

---

## Phase 4: User Story 2 — Historical Attendance Query (Priority: P2)

**Goal**: User selects a date range and sees "X/Y días" per colaborador for that period.

**Independent Test**: Select "Esta semana" → each colaborador shows correct days-attended count for the current week.

### Implementation for User Story 2

- [x] T014 [P] [US2] Implement quick filter chips (Hoy/Ayer/Esta semana/Personalizado) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T015 [P] [US2] Implement date range inputs (Desde/Hasta) that switch quick filter to "Personalizado" on change in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T016 [P] [US2] Implement `subtractDays`, `startOfWeekBolivia`, `diasEnRango`, `formatFechaCorta` helpers in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T017 [US2] Add committed filter state + `applyFilter` callback (two-state pattern: pending inputs → committed filter triggers fetch) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T018 [US2] Implement `isMultiDay` branch in `ColaboradorRow`: show "X/Y días" chip (with `presenceColor`) instead of individual marcaciones in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T019 [US2] Add "Rango N días" segment to summary banner when `isMultiDay` is true in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T020 [US2] Add date range validation: show error when `fechaDesde > fechaHasta` and block fetch in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`

**Checkpoint**: User Story 2 fully functional — historical date range queries working ✅

---

## Phase 5: User Story 3 — Colaborador Period Summary (Priority: P3)

**Goal**: Search for a colaborador by name/ID, apply date range, see only their attendance detail.

**Independent Test**: Type a colaborador's name in the search field, press Enter or click "Filtrar" → only that person's rows appear.

### Implementation for User Story 3

- [x] T021 [P] [US3] Implement colaborador search TextField (with SearchIcon adornment, Enter key submit) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T022 [US3] Wire colaborador search value into committed filter state so Filtrar button + Enter both trigger fetch in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T023 [US3] Handle empty results: show "No hay datos para el período seleccionado." message when `data.areas.length === 0` in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`

**Checkpoint**: User Story 3 fully functional — colaborador-specific period summary working ✅

---

## Phase 6: User Story 4 — Area Breakdown Navigation (Priority: P4)

**Goal**: Collapsible area cards with color-coded coverage indicators; "Sin área" group for unassigned colaboradores.

**Independent Test**: Collapse all cards → only area header rows visible. Expand one → colaborador list appears. An unassigned colaborador appears under "Sin área".

### Implementation for User Story 4

- [x] T024 [P] [US4] Implement collapsible state on `AreaCard` with `ExpandMoreIcon` toggle and `Collapse` animation in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T025 [P] [US4] Apply color-coded left border to `AreaCard` header using `presenceColor()` thresholds (≥80% green, ≥40% orange, <40% red) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T026 [US4] Render absent colaborador count ("+ N ausentes ocultos") when `showAbsent = false` in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`

**Checkpoint**: User Story 4 fully functional — area cards collapsible with visual coverage indicators ✅

---

## Phase 7: Polish & Cross-Cutting Concerns (prior session)

**Purpose**: Constitution compliance (Principle X auto-refresh) and verification.

- [x] T027 Add 60-second auto-refresh interval to `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`: use `setInterval` that re-fires the fetch with the current filter only when `quick === 'hoy'`; clear the interval when `quick` changes or the component unmounts; background refresh must NOT show the full loading spinner (use a separate `refreshing` boolean for background ticks)
- [x] T028 [P] Run TypeScript check: `cd apps/web && npx tsc --noEmit` — must produce no errors
- [x] T029 [P] Verify dashboard renders in browser: open home screen, confirm area cards, summary banner, and filter controls are present
- [x] T030 Manual smoke test per quickstart.md: verify "Hoy" / "Ayer" / "Esta semana" / custom range / colaborador search all produce correct results

---

## Phase 8: FR-015 — Arrival-Order Sort (added 2026-06-18)

**Goal**: Colaboradores within each area card are ordered by first punch time (earliest arrival first) in single-day view. Absent colaboradores appear at the end, sorted alphabetically. Multi-day view retains alphabetical order.

**Independent Test**: Open the dashboard with "Hoy" selected. Within any area card that has present colaboradores, verify that the person with the earliest marcacion appears first. Verify absent colaboradores (gray dot, "Sin registro") appear after all present ones.

### Implementation for FR-015

- [x] T031 In `apps/web/src/app/api/dashboard/asistencia/route.ts`, after the `areaMap` construction loop, add a JS sort block: if `fechaDesde === fechaHasta`, sort each area's `colaboradores` array by `dias[0]?.marcaciones[0]` ascending (present first, earliest first); absent colaboradores (empty `dias`) sorted by `apellido nombre` at end using `localeCompare('es')`

### Verification

- [x] T032 [P] Run TypeScript check: `cd apps/web && npx tsc --noEmit` — must produce no errors after T031
- [x] T033 [P] Manual smoke test for FR-015: open dashboard on "Hoy" → confirm first colaborador in each area has the earliest time chip; switch to "Esta semana" → confirm order reverts to alphabetical by surname

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phases 1–7**: All complete ✅
- **Phase 8 (FR-015)**: No new dependencies — modifies only `route.ts` post-query JS

### User Story Dependencies

- **US1 (P1)**: ✅ complete
- **US2 (P2)**: ✅ complete
- **US3 (P3)**: ✅ complete
- **US4 (P4)**: ✅ complete

### Within FR-015 Phase

- T031 must complete before T032 and T033 (which can then run in parallel)

---

## Parallel Example: Phase 8 (FR-015)

```bash
# T031 first (sole implementation task):
Task: "Add arrival-order sort after areaMap loop in route.ts"

# Then in parallel:
Task: "tsc --noEmit" (T032)
Task: "Manual smoke test — verify arrival order on Hoy, alphabetical on Esta semana" (T033)
```

---

## Implementation Strategy

### Remaining Work (3 tasks)

1. **T031** — Single file change in `route.ts`. After the closing brace of the `for (const row of res.rows)` loop and before `return NextResponse.json(...)`:

   ```typescript
   const isSingleDay = fechaDesde === fechaHasta;
   if (isSingleDay) {
     for (const area of areaMap.values()) {
       (area.colaboradores as Array<{ dias: Array<{ marcaciones: string[] }>; apellido: string; nombre: string }>)
         .sort((a, b) => {
           const aTime = a.dias[0]?.marcaciones[0];
           const bTime = b.dias[0]?.marcaciones[0];
           if (aTime && bTime) return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
           if (aTime) return -1;
           if (bTime) return 1;
           return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es');
         });
     }
   }
   ```

2. **T032** — `cd apps/web && npx tsc --noEmit`
3. **T033** — Manual smoke test in browser

### MVP Status

All 4 original user stories complete. FR-015 is a single-task enhancement requiring one ~15-line change to `route.ts`.

---

## Notes

- `[x]` = already implemented and committed
- `[ ]` = remaining work
- `[P]` tasks = different files, no dependencies, can run in parallel
- The entire feature lives in 2 files: `DashboardClient.tsx` and `asistencia/route.ts`
- FR-015 only touches `asistencia/route.ts` — no frontend changes required
- No DB tables, migrations, or NestJS backend changes required
