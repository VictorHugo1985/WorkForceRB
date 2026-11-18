# Tasks: Tipo de Colaborador — Campo Fijo

**Input**: Design documents from `specs/019-add-fijo-field/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and Prisma schema updates — blocking prerequisites for all user stories.

- [x] T001 Create migration file `apps/api/prisma/migrations/20260618_025_add_fijo_colaborador/migration.sql` with `ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS fijo BOOLEAN NOT NULL DEFAULT false;` and a `-- DOWN:` comment
- [x] T002 [P] Add `fijo Boolean @default(false)` field to the `Colaborador` model in `packages/database/prisma/schema.prisma` (place after `activo` field)
- [x] T003 [P] Add `fijo Boolean @default(false)` field to the `Colaborador` model in `apps/api/prisma/schema.prisma` (place after `activo` field)

**Checkpoint**: Migration SQL exists and both Prisma schemas are updated — DB layer ready for all user stories ✅

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API layer — expose `fijo` on all collaborator endpoints and enforce exclusion in planilla.

**⚠️ CRITICAL**: No user story UI work can begin until this phase is complete.

- [x] T004 In `apps/web/src/app/api/colaboradores/route.ts`: add `c.fijo` to the GET SELECT query; add `fijo: r.fijo` to the response map; add `fijo: z.boolean().optional().default(false)` to `ColaboradorSchema`; add `fijo` column to the INSERT query
- [x] T005 In `apps/web/src/app/api/colaboradores/[id]/route.ts`: add `c.fijo` to the GET SELECT query and include `fijo: col.fijo` in the response JSON; add `fijo: z.boolean().optional()` to `EditSchema`; add `fijo = $N` to the UPDATE SET clause; include `fijo` (previous and new value) in `datos_anteriores` and `datos_nuevos` of the audit log INSERT
- [x] T006 In `apps/web/src/app/api/planilla/[semanaId]/route.ts`: add `AND c.fijo = false` to the WHERE clause of the `rosterRes` SQL query (after the `tipo_pago` filter line)

**Checkpoint**: Foundation ready — API correctly includes `fijo` field and planilla excludes `fijo = true` collaborators ✅

---

## Phase 3: User Story 1 — Clasificar Colaborador como Fijo o Jornalero (Priority: P1) 🎯 MVP

**Goal**: Admin can set `fijo` during registration and in the edit form. The collaborator profile shows the classification.

**Independent Test**: Register a new collaborator with fijo = true → profile shows "Fijo" badge. Register another with default → profile shows "Jornalero". Edit the first one back to jornalero → profile updates.

### Implementation for User Story 1

- [x] T007 [P] [US1] In `apps/web/src/components/colaboradores/steps/Step1DatosPersonales.tsx`: add a `fijo` boolean field to the step's form state and render an MUI `Switch` labelled "Colaborador Fijo" with helper text "Los colaboradores fijos no participan en el cálculo de liquidaciones por horas."
- [x] T008 [P] [US1] In `apps/web/src/components/colaboradores/RegistroWizard.tsx`: add `fijo: false` to the initial form values, add `fijo: z.boolean().default(false)` to the Zod schema, and include `fijo` in the POST body sent to `/api/colaboradores`
- [x] T009 [US1] In `apps/web/src/components/colaboradores/ColaboradorPerfil.tsx`: fetch `fijo` from the GET response and display an MUI `Chip` — `"Fijo"` (color `"warning"`) or `"Jornalero"` (color `"default"`, variant `"outlined"`) — near the collaborator's name/header area; render the Switch as disabled (read-only) for SUPERVISOR role

**Checkpoint**: User Story 1 fully functional — fijo classification visible in profile and settable during registration ✅

---

## Phase 4: User Story 2 — Exclusión de Colaboradores Fijos del Cálculo de Liquidaciones (Priority: P2)

**Goal**: Collaborators with `fijo = true` do not appear in the planilla roster for any week, regardless of whether they have punch events.

**Independent Test**: Assign punch events to a `fijo = true` collaborator for the current week. Open Planilla for that week — the collaborator is absent from the roster. A `fijo = false` collaborator with punches still appears.

### Implementation for User Story 2

*No additional tasks — T006 (Phase 2) is the sole implementation for this story. The API-level WHERE clause is the complete solution.*

**Checkpoint**: User Story 2 is complete once T006 is done ✅

---

## Phase 5: User Story 3 — Visibilidad del Tipo en el Listado de Colaboradores (Priority: P3)

**Goal**: The collaborator list shows the `fijo` / `jornalero` classification per row and allows filtering by type.

**Independent Test**: The collaborador list shows "Fijo" or "Jornalero" chips on each row. Applying the "Fijo" filter shows only `fijo = true` collaborators. Clearing the filter restores all.

### Implementation for User Story 3

- [x] T010 [US3] In `apps/web/src/app/(app)/colaboradores/ColaboradoresListClient.tsx`: add `fijo` to the TypeScript interface for collaborator rows; render an MUI `Chip` (`"Fijo"` warning / `"Jornalero"` default outlined) in a new column or alongside the name; add a filter chip group (`"Todos"` / `"Fijo"` / `"Jornalero"`) above the table that filters the displayed rows client-side

**Checkpoint**: User Story 3 fully functional — list shows type chips and filter works ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: TypeScript validation and manual verification.

- [x] T011 [P] Run TypeScript check: `cd apps/web && npx tsc --noEmit` — must produce no errors
- [ ] T012 [P] Manual smoke test per quickstart.md Scenario 1 (register fijo) and Scenario 2 (fijo excluded from planilla)
- [ ] T013 [P] Manual smoke test per quickstart.md Scenario 3 (reclassify jornalero → fijo) and Scenario 4 (SUPERVISOR read-only)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001–T003) — BLOCKS all user stories
- **User Stories (Phases 3–5)**: All depend on Foundational (Phase 2) completion
- **Polish (Phase 6)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational — T007, T008, T009 can run in parallel once T004+T005 done
- **US2 (P2)**: Fully implemented by T006 (Foundational) — no additional tasks
- **US3 (P3)**: Depends on Foundational (T004 must expose `fijo` in list response) — T010 runs after T004

### Within Each User Story

- T007 (step form) and T008 (wizard wiring) are independent files → parallel
- T009 (profile display) can run in parallel with T007/T008

---

## Parallel Example: Phase 1 (Setup)

```bash
# All three can run simultaneously (different files):
Task: "Add migration SQL to apps/api/prisma/migrations/20260618_025_add_fijo_colaborador/migration.sql" (T001)
Task: "Add fijo to packages/database/prisma/schema.prisma" (T002)
Task: "Add fijo to apps/api/prisma/schema.prisma" (T003)
```

## Parallel Example: User Story 1 (Phase 3)

```bash
# T007 and T008 target different files — parallel:
Task: "Add fijo Switch to Step1DatosPersonales.tsx" (T007)
Task: "Wire fijo into RegistroWizard form state and POST body" (T008)
# T009 depends on T008 (wizard must send fijo for profile to receive it):
Task: "Show fijo badge in ColaboradorPerfil.tsx" (T009)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006) — CRITICAL
3. Complete Phase 3: US1 registration + profile display (T007–T009)
4. **STOP and VALIDATE**: US1 + US2 are testable — `fijo` classifiable and excluded from planilla
5. Add Phase 5 (US3) for list view

### Incremental Delivery

1. **Phase 1 + 2** → DB column exists, API routes expose + enforce `fijo` → Foundation ready
2. **Phase 3 (US1)** → Registration + profile → Admin can set/view type
3. **Phase 4 (US2)** → Already done via T006 → Planilla excludes fijo
4. **Phase 5 (US3)** → List chip + filter → Supervisory overview
5. **Phase 6** → TypeScript + smoke test

---

## Notes

- `[P]` tasks = different files, no dependencies, can run in parallel
- T006 in Phase 2 is the sole implementation of US2 — no additional phase needed
- All API routes already use `checkAdminRole` — no new auth code needed for role enforcement
- The `fijo` column default `false` in the migration satisfies FR-008 (retroactive jornalero for all existing collaborators) without a data backfill script
- SUPERVISOR read-only behavior for `fijo` is enforced by the server (`checkAdminRole` blocks PATCH) — frontend just renders the switch as `disabled`
