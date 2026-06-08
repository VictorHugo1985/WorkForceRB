# Tasks: Attendance Dashboard

**Input**: Design documents from `specs/018-attendance-dashboard/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Status note**: The core implementation was shipped as part of branch `017-period-date-marcacion-calc`. Tasks already completed are marked `[x]`. One task remains open for constitutional compliance.

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

**Independent Test**: Open dashboard → without any filters, all active collaboradores appear grouped by area, with green/gray dots and today's punch times.

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

**Goal**: User selects a date range and sees "X/Y días" per collaborador for that period.

**Independent Test**: Select "Esta semana" → each collaborador shows correct days-attended count for the current week.

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

## Phase 5: User Story 3 — Collaborador Period Summary (Priority: P3)

**Goal**: Search for a collaborador by name/ID, apply date range, see only their attendance detail.

**Independent Test**: Type a collaborador's name in the search field, press Enter or click "Filtrar" → only that person's rows appear.

### Implementation for User Story 3

- [x] T021 [P] [US3] Implement collaborador search TextField (with SearchIcon adornment, Enter key submit) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T022 [US3] Wire collaborador search value into committed filter state so Filtrar button + Enter both trigger fetch in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T023 [US3] Handle empty results: show "No hay datos para el período seleccionado." message when `data.areas.length === 0` in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`

**Checkpoint**: User Story 3 fully functional — collaborador-specific period summary working ✅

---

## Phase 6: User Story 4 — Area Breakdown Navigation (Priority: P4)

**Goal**: Collapsible area cards with color-coded coverage indicators; "Sin área" group for unassigned collaboradores.

**Independent Test**: Collapse all cards → only area header rows visible. Expand one → collaborator list appears. An unassigned collaborador appears under "Sin área".

### Implementation for User Story 4

- [x] T024 [P] [US4] Implement collapsible state on `AreaCard` with `ExpandMoreIcon` toggle and `Collapse` animation in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T025 [P] [US4] Apply color-coded left border to `AreaCard` header using `presenceColor()` thresholds (≥80% green, ≥40% orange, <40% red) in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`
- [x] T026 [US4] Render absent collaborador count ("+ N ausentes ocultos") when `showAbsent = false` in `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`

**Checkpoint**: User Story 4 fully functional — area cards collapsible with visual coverage indicators ✅

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance, TypeScript validation, and verification.

- [x] T027 Add 60-second auto-refresh interval to `apps/web/src/app/(app)/dashboard/DashboardClient.tsx`: use `setInterval` that re-fires the fetch with the current filter only when `quick === 'hoy'`; clear the interval when `quick` changes or the component unmounts; background refresh must NOT show the full loading spinner (use a separate `refreshing` boolean for background ticks)
- [x] T028 [P] Run TypeScript check: `cd apps/web && npx tsc --noEmit` — must produce no errors
- [x] T029 [P] Verify dashboard renders in browser: open home screen, confirm area cards, summary banner, and filter controls are present
- [x] T030 Manual smoke test per quickstart.md: verify "Hoy" / "Ayer" / "Esta semana" / custom range / collaborador search all produce correct results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — ✅ complete
- **Foundational (Phase 2)**: Depends on Setup — ✅ complete; unblocked all user stories
- **User Stories (Phases 3–6)**: All depend on Foundational — ✅ complete
- **Polish (Phase 7)**: Depends on all user stories — 1 task remaining (T027)

### User Story Dependencies

- **US1 (P1)**: No story dependencies — ✅ complete
- **US2 (P2)**: No story dependencies — ✅ complete (builds on US1 component, but independently testable)
- **US3 (P3)**: No story dependencies — ✅ complete
- **US4 (P4)**: No story dependencies — ✅ complete

### Within Each User Story

- Models before services before endpoints (all complete in this feature — read-only query pattern)
- Each story is implemented within a single client component + single API route

---

## Parallel Example: Phase 7 (only remaining work)

```bash
# T027 is the only remaining open task:
Task: "Add 60-second auto-refresh interval for 'Hoy' filter in DashboardClient.tsx"
# After T027:
Task: "Run tsc --noEmit" (T028)
Task: "Manual smoke test per quickstart.md" (T030)
```

---

## Implementation Strategy

### Remaining Work (1 task)

1. **T027**: Add auto-refresh interval to `DashboardClient.tsx`
   - When `quick === 'hoy'`: start a 60-second `setInterval` that calls the fetch without triggering the main loading spinner
   - When `quick` changes away from `'hoy'` OR component unmounts: `clearInterval`
   - Use a `useEffect` keyed on `[quick]` to manage the interval lifecycle
   - Add a `refreshing` state (boolean) separate from `loading` to show a subtle indicator (e.g., small progress bar or icon) during background ticks
2. **Run** `tsc --noEmit` — verify clean
3. **Manual verify**: Open dashboard → network tab → confirm 60s polling on "Hoy", no polling on other filters

### MVP Status

All 4 user stories are complete. The feature is functional and usable. T027 is a constitutional compliance addition, not a blocker for user value.

---

## Notes

- `[x]` = already implemented and committed
- `[ ]` = remaining work
- [P] tasks = different files, no dependencies, can run in parallel
- The entire feature lives in 2 files: `DashboardClient.tsx` and `asistencia/route.ts`
- No new DB tables, migrations, or backend changes required
