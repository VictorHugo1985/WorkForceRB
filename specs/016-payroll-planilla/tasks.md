# Tasks: Weekly Payroll Planilla

**Input**: Design documents from `specs/016-payroll-planilla/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅

**Tests**: Not requested. No test tasks included.

**Organization**: Tasks grouped by user story. No new npm packages or DB migrations required.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 = View Weekly Planilla · US2 = Inline Hour Adjustment · US3 = Per-Collaborator Confirmation

---

## Phase 1: Foundational — New API Endpoints (Blocking Prerequisites)

**Purpose**: Two new Route Handlers that all three user stories depend on. MUST be complete before any
component work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Create `apps/web/src/app/api/planilla/[semanaId]/route.ts` — `GET` handler: join `eventos_biometricos_desglosados` × `codigos_colaborador` × `semanas_laborales` to find collaborators with ≥ 1 punch in week; join `liquidaciones_semanales` (may be absent — do not create borradores here); compute `maxShifts = MAX(CEIL(max_punches_per_day / 2.0))`; return `{ semana, maxShifts, colaboradores[] }` where each entry has `{ liquidacionId, colaboradorId, nombre, apellido, semanaId, estado }`; use `checkLiquidacionRole` from `@/lib/liquidacion-db`; return 200 with empty array if no punches found

- [X] T002 [P] Create `apps/web/src/app/api/liquidaciones/[id]/route.ts` — `GET` handler: look up `colaborador_id` + `semana_id` from `liquidaciones_semanales` by path param `id`, then call `getLiquidacionDetail(client, colaboradorId, semanaId)` from `@/lib/liquidacion-db`; use `checkLiquidacionRole`; return the full enriched payload (dias with jornadas, horasParejadas, tieneInconsistencia, etc.); return 404 if not found

**Checkpoint**: Both endpoints available and returning correct shapes before component work.

---

## Phase 2: User Story 1 — View Weekly Planilla (Priority: P1) 🎯 MVP

**Goal**: Replace the collaborator-list page at `/liquidaciones` with the spreadsheet planilla view showing
per-day rows, shift columns, accumulated hours, and collaborator summary rows.

**Independent Test**: Select any work week with biometric events. Verify the planilla loads showing only
collaborators with ≥ 1 punch, each block has the correct day rows and ENT/SAL shift cells populated, and
the summary row shows total hours, tarifa, and total payment. Confirm the collaborator name links to the
detail page in a new tab.

- [X] T003 [P] [US1] Replace `apps/web/src/app/(app)/liquidaciones/page.tsx` — remove all DB queries and `LiquidacionesListClient` import; keep only JWT auth guard (verify + blacklist check, redirect to `/login?reason=expired`); return `<PlanillaView />` from `@/components/liquidaciones/PlanillaView`; page must be a `default async function` Server Component

- [X] T004 [US1] Create `apps/web/src/components/liquidaciones/PlanillaView.tsx` — `'use client'` component; on mount fetch `GET /api/semanas-laborales` to populate `semanas[]`; auto-select the most recent semana with `estado === 'ABIERTA'` as default `selectedSemanaId`; on `selectedSemanaId` change fetch `GET /api/planilla/[semanaId]` to get `roster[]` + `maxShifts`; render MUI `<Select>` week selector (same pattern as `LiquidacionesListClient`); render one `<LiquidacionColaborador>` per roster entry passing `{ liquidacionId, colaboradorId, nombre, apellido, semanaId, maxShifts, onEstadoChange }`; `onEstadoChange` updates roster entry estado in local state; show `<CircularProgress>` during load; show empty-state Typography when `roster.length === 0` after load

- [X] T005 [US1] Create `apps/web/src/components/liquidaciones/LiquidacionColaborador.tsx` — `'use client'` component; on mount fetch `GET /api/liquidaciones/[liquidacionId]`; store full `LiquidacionData` in local state; render a MUI `<Paper>` block with: (a) header row — collaborator name as MUI `<Link>` with `href="/liquidaciones/[semanaId]/[colaboradorId]"` and `target="_blank"`, plus `<Chip>` showing estado; (b) a `<Table>` with column headers for Fecha + ENT.1/SAL.1…ENT.N/SAL.N (N = `maxShifts`) + Horas + Estado; (c) one `<PlanillaDiaRow>` per `liquidacion.dias[]`; (d) a summary row showing `horasOrdinarias`, `tarifa_hora` (from collaborator data — pass through from roster or fetch separately), and `totalPago`; show `<CircularProgress>` during initial load; expose `onDiaUpdate(updatedDia, updatedTotales)` method merged into local state and `onEstadoChange(liquidacionId, estado)` prop

- [X] T006 [US1] Create `apps/web/src/components/liquidaciones/PlanillaDiaRow.tsx` — `'use client'` component; receives `{ dia: DiaLiquidacionData, maxShifts: number, isReadOnly: boolean, semanaId: string, onDiaUpdate: fn }`; render MUI `<TableRow>` with: fecha cell (formatted `DD/MM` with day name); one pair of ENT/SAL cells per shift up to `maxShifts` — populate from `dia.jornadas[i].entrada/salida`, leave blank if shift index exceeds `dia.jornadas.length`; hours cell — static display showing `dia.horasAjustadasSupervisor ?? dia.horasParejadas ?? dia.horasCalculadas`, with "Ajustado" MUI `<Chip size="small">` if `dia.horasAjustadasSupervisor !== null` and greyed original `horasParejadas` beneath; inconsistency warning "⚠" `<Tooltip>` if `dia.tieneInconsistencia`; estado cell showing `dia.estadoDia`; inline edit in hours cell is rendered as `<InlineHorasCell>` (added in US2 — for US1 render read-only display only)

**Checkpoint**: Planilla loads, week selector works, all collaborator blocks display day rows with correct
shift times and hours. Collaborator name links open detail page in new tab.

---

## Phase 3: User Story 2 — Inline Hour Adjustment (Priority: P2)

**Goal**: Add click-to-edit behavior to the hours cell in each day row. No dialog — inline edit only.
Edit requires a motivo, saves on Enter, cancels on Escape.

**Independent Test**: Click the hours cell for any `SIN_REVISION` day row. Verify the cell enters edit
mode with a number input and motivo field. Enter a new value and motivo, press Enter — verify the cell
updates and the collaborator summary row recalculates total hours and payment without a page reload.
Press Escape without saving — verify original value is restored.

- [X] T007 [US2] Create `apps/web/src/components/liquidaciones/InlineHorasCell.tsx` — `'use client'` component; receives `{ diaId: string, currentHoras: number, isReadOnly: boolean, onSaved: (updatedDia, updatedTotales) => void }`; local state: `editing`, `draftHoras`, `draftMotivo`, `saving`, `error`; when `!isReadOnly` and `!editing`: render static value as clickable `<Box onClick>` that sets `editing=true`; when `editing`: render MUI `<TextField type="number">` (MUI v6: `slotProps={{ htmlInput: { step: 0.25, min: 0 } }}`) next to a `<TextField label="Motivo">` inline; on `onKeyDown` Enter: if `draftMotivo.trim()` is empty set required error and return; else call `PATCH /api/dias-liquidacion/[diaId]` with `{ horasAjustadasSupervisor: parseFloat(draftHoras), motivoAjuste: draftMotivo.trim() }`; on success call `onSaved(updatedDia, updatedTotales)` and set `editing=false`; on `onKeyDown` Escape: set `editing=false`, restore `draftHoras` + `draftMotivo`; on server error show inline error message; do NOT save on blur (only on Enter)

- [X] T008 [US2] Update `apps/web/src/components/liquidaciones/PlanillaDiaRow.tsx` — replace the static hours display in the hours cell with `<InlineHorasCell>` when `!isReadOnly`; pass `diaId=dia.id`, `currentHoras=(dia.horasAjustadasSupervisor ?? dia.horasParejadas ?? dia.horasCalculadas)`, `isReadOnly`, and `onSaved=onDiaUpdate`; keep static display when `isReadOnly=true` or `dia.estadoDia === 'APROBADO'`

- [X] T009 [US2] Update `apps/web/src/components/liquidaciones/LiquidacionColaborador.tsx` — implement `onDiaUpdate(updatedDia, updatedTotales)` handler: find the matching dia in `liquidacion.dias[]` by `id`, replace it with `updatedDia`, update `liquidacion` totals (`horasOrdinarias`, `totalPago`, etc.) from `updatedTotales`; propagate `isReadOnly = liquidacion.estado === 'APROBADO'` down to each `PlanillaDiaRow`

**Checkpoint**: Clicking hours cell enters edit mode, Enter saves and updates totals, Escape restores,
empty motivo is blocked, confirmed-collaborator rows remain non-editable.

---

## Phase 4: User Story 3 — Per-Collaborator Confirmation (Priority: P2)

**Goal**: Add a "Confirmar" button at the bottom of each collaborator block. Clicking it approves the
collaborator's full week liquidación. If any day has inconsistencies, an inline warning must be
acknowledged before the POST fires. After confirmation the block becomes read-only.

**Independent Test**: With two collaborators in the planilla, click "Confirmar" on one (with no
inconsistencies). Verify only that collaborator's block locks and shows "✓ Aprobado". Reload the page
and verify the block remains locked. For a collaborator with inconsistency flags, click "Confirmar" and
verify the warning expands; check the checkbox and click again — verify the confirmation succeeds.

- [X] T010 [US3] Create `apps/web/src/components/liquidaciones/ConfirmarColaboradorButton.tsx` — `'use client'` component; receives `{ liquidacionId: string, hasInconsistencias: boolean, isConfirmed: boolean, onConfirmed: () => void }`; if `isConfirmed`: render `<Chip label="✓ Aprobado" color="success" />`; else render MUI `<Button variant="contained" color="primary">Confirmar</Button>`; on click: if `!hasInconsistencias` → POST `/api/liquidaciones/[liquidacionId]/aprobar` then call `onConfirmed()`; if `hasInconsistencias` → set `showWarning=true` → render inline MUI `<Alert severity="warning">` with `<FormControlLabel>` checkbox "Reconozco las inconsistencias — confirmar de todas formas" and a second "Confirmar de todas formas" `<Button disabled={!acknowledged}>`; when checkbox checked + second button clicked → POST then call `onConfirmed()`; show `<CircularProgress size={20}>` during POST; show inline error on 4xx/5xx

- [X] T011 [US3] Update `apps/web/src/components/liquidaciones/LiquidacionColaborador.tsx` — add `<ConfirmarColaboradorButton>` at the bottom of the collaborator block as the last row before closing `</Paper>`; pass `liquidacionId=liquidacion.id`, `hasInconsistencias=liquidacion.dias.some(d => d.tieneInconsistencia)`, `isConfirmed=liquidacion.estado === 'APROBADO'`; `onConfirmed`: set `liquidacion.estado = 'APROBADO'` in local state (making all day cells read-only), call `onEstadoChange(liquidacionId, 'APROBADO')` prop so `PlanillaView` can update the roster chip

**Checkpoint**: Per-collaborator confirmation works independently. Other collaborator blocks unaffected.
Confirmed blocks reload as read-only after page refresh.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Completeness for edge cases and UX details across all stories.

- [X] T012 [P] Update `apps/web/src/components/liquidaciones/PlanillaView.tsx` — add "Semana completa" `<Chip label="Semana completa" color="success" />` below the week selector when all `roster` entries have `estado === 'APROBADO'` and `roster.length > 0`; add horizontal `overflowX: 'auto'` scroll container around the collaborator blocks table area for wide weeks with many ENT/SAL columns (FR-015)

- [X] T013 [P] Update `apps/web/src/components/liquidaciones/LiquidacionColaborador.tsx` — add `tarifa_hora` to the summary row: fetch collaborator tarifa from the liquidacion detail response (the existing `GET /api/liquidaciones/[id]` payload includes `horasOrdinarias` and `totalPago`; expose `tarifa_hora` by adding a `c.tarifa_hora` JOIN to `getLiquidacionDetail` in `apps/web/src/lib/liquidacion-db.ts` and returning it in the payload shape); display as "Tarifa: X Bs./h" in the summary row

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — can start immediately. **BLOCKS all user stories.**
- **US1 (Phase 2)**: Depends on both T001 + T002. T003 and T004 can start in parallel.
- **US2 (Phase 3)**: Depends on US1 complete (needs `PlanillaDiaRow` + `LiquidacionColaborador` to exist).
- **US3 (Phase 4)**: Depends on US1 complete; can run in parallel with US2.
- **Polish (Phase 5)**: Depends on US1 + US2 + US3 complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependency on US2 or US3.
- **US2 (P2)**: Can start after US1 completes — adds edit behavior to existing components.
- **US3 (P2)**: Can start after US1 completes — adds confirmation to existing block; independent from US2.

### Within Each Phase

- T001 and T002 (Foundational) are fully parallel — different files.
- T003 and T004 (US1 setup) are parallel — page.tsx replacement does not depend on `PlanillaView` content being complete before the file exists.
- T005 (LiquidacionColaborador) depends on T004 (PlanillaView must import it).
- T006 (PlanillaDiaRow) can be written before T005 since it is a child component.
- T007 (InlineHorasCell) is independent; T008 depends on T007; T009 depends on T008.
- T010 (ConfirmarColaboradorButton) is independent of US2 tasks; T011 depends on T010.

---

## Parallel Execution Examples

```bash
# Foundational phase — full parallel:
Task T001: Create apps/web/src/app/api/planilla/[semanaId]/route.ts
Task T002: Create apps/web/src/app/api/liquidaciones/[id]/route.ts

# US1 — page + view can start in parallel:
Task T003: Replace apps/web/src/app/(app)/liquidaciones/page.tsx
Task T004: Create apps/web/src/components/liquidaciones/PlanillaView.tsx

# US2 + US3 can run in parallel after US1:
Task T007: Create apps/web/src/components/liquidaciones/InlineHorasCell.tsx
Task T010: Create apps/web/src/components/liquidaciones/ConfirmarColaboradorButton.tsx
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1 (Foundational): T001, T002
2. Complete Phase 2 (US1): T003 → T004 → T005 → T006
3. **STOP and validate**: Select a week with biometric events; verify planilla loads with correct day rows and shift cells.
4. Ship MVP — managers can view the planilla and click through to detail pages.

### Full Feature Delivery

1. Foundation (T001–T002)
2. US1 (T003–T006) → validate
3. US2 (T007–T009) in parallel with US3 (T010–T011)
4. Polish (T012–T013)

---

## Notes

- `[P]` = different files, no blocking dependencies between them
- MUI v6 rule: use `slotProps={{ htmlInput: ... }}` not `inputProps`; Zod v4: no `invalid_type_error` option on `z.number()`
- `getLiquidacionDetail` in `apps/web/src/lib/liquidacion-db.ts` already creates borradores and computes jornadas — reuse it via T002
- The existing `LiquidacionesListClient.tsx` can be kept as dead code; it no longer renders after T003
- The `tarifa_hora` field is needed in the summary row (T013) — `getLiquidacionDetail` must be extended to JOIN and return it
