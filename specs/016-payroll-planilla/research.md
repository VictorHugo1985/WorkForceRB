# Research: Weekly Payroll Planilla

**Feature**: 016-payroll-planilla | **Date**: 2026-06-01

## Decision 1: State Management per Collaborator Block

**Decision**: Each `LiquidacionColaborador` component manages its own data via `useState` / `useReducer` (local React state), not the global `useLiquidacionStore`.

**Rationale**: `useLiquidacionStore` is a Zustand singleton designed for a single collaborator's detail page. Rendering 20–30 `LiquidacionColaborador` blocks simultaneously would cause all components to share the same store, overwriting each other's data. Local state per component is the correct pattern for independent, self-contained blocks.

**Alternatives considered**:
- Zustand store factory (`createLiquidacionStore()` called per component) — adds complexity and requires cleanup on unmount; local state is simpler and sufficient since blocks don't need cross-block communication.
- Single store with a `Map<liquidacionId, LiquidacionData>` — over-engineered; no use case requires reading another collaborator's state.

---

## Decision 2: New API Endpoint for Planilla Roster

**Decision**: New `GET /api/planilla/[semanaId]` endpoint returns the lightweight roster (liquidacionId, colaboradorId, nombre, estado) plus the week-global `maxShifts` value.

**Rationale**: The existing `GET /api/liquidaciones` requires both `colaborador_id` and `semana_id` — it cannot return all collaborators for a week. A dedicated planilla roster endpoint allows a single round-trip to discover which `LiquidacionColaborador` components to render and how many ENT/SAL columns to show globally.

**Roster filter**: Only collaborators with at least one biometric event (`eventos_biometricos_desglosados`) in the week's date range are included — consistent with FR-001 and FR-014.

**`maxShifts` computation**: `MAX(CEIL(max_punches_per_day / 2))` over all collaborators in the week. Computed in the same query via CTEs to avoid a round-trip per collaborator.

**Alternatives considered**:
- Page-level server fetch (Server Component) with searchParam-driven week selection — rejected because the spec requires client-side dynamic loading where each component manages its own cycle.
- Returning full liquidacion data for all collaborators in one request — rejected because it couples roster loading with per-collaborator detail and prevents independent loading spinners per block.

---

## Decision 3: New `GET /api/liquidaciones/[id]` Endpoint

**Decision**: Create `apps/web/src/app/api/liquidaciones/[id]/route.ts` as a new `GET` handler that looks up `colaborador_id` + `semana_id` from the record and calls the existing `getLiquidacionDetail()`.

**Rationale**: The existing `getLiquidacionDetail` already builds the full enriched payload (jornadas, horasParejadas, marcacionesExcluidas, etc.) used by the detail page. Reusing it avoids duplicating business logic. The `[id]` directory already exists as a parent of `/aprobar`, so only `route.ts` needs to be added.

**Alternatives considered**:
- Reusing `GET /api/liquidaciones?colaborador_id=X&semana_id=Y` from each component — requires each `LiquidacionColaborador` to receive both params as props; works but couples the component to the roster endpoint response shape more tightly than needed.

---

## Decision 4: Planilla Page Architecture

**Decision**: Thin server page (`planilla/page.tsx`) with auth check only, renders client component `<PlanillaView />` which handles all data fetching.

**Rationale**: Week selection is interactive (client-side) and each collaborator block loads independently. Starting with a server page only to immediately hydrate into fully client-controlled behavior adds complexity. The existing `/liquidaciones` page server-fetches all data upfront — the planilla cannot do this because it needs independent loading per collaborator.

**Pattern**:
```
planilla/page.tsx (Server — auth guard only)
  └─ PlanillaView (Client — week selector + roster fetch)
       └─ LiquidacionColaborador × N (Client — self-loads via /api/liquidaciones/[id])
            ├─ PlanillaDiaRow × days (inline edit)
            └─ Summary row + Confirmar button
```

---

## Decision 5: Inline Edit Interaction

**Decision**: Click on hours cell → controlled `<input type="number">` replaces the text; motivo `<TextField>` appears inline; Enter or blur (if motivo non-empty) saves; Escape restores original.

**Rationale**: FR-006 / FR-007 — no dialog. The existing `DiaAjusteDialog` dialog pattern is explicitly replaced for the planilla. The PATCH call reuses the existing `PATCH /api/dias-liquidacion/[id]` endpoint (already accepts `horasAjustadasSupervisor` + `motivoAjuste`).

**Blur-to-save caveat**: blur fires before the motivo field can receive focus when the user tabs from the hours field. Solution: use `onBlur` with a `setTimeout(0)` check — if the next focused element is the motivo field, defer save. Alternatively, save only on Enter (simpler, spec-compliant since FR-007 says "Enter or focus-loss confirmation").

---

## Decision 6: Confirmation Flow for Inconsistency Warning

**Decision**: When collaborator has inconsistent days and reviewer clicks "Confirmar", an inline warning expands below the button with a checkbox "Reconozco las inconsistencias — confirmar de todas formas". The POST to `/api/liquidaciones/[id]/aprobar` fires only after the checkbox is checked and Confirmar is clicked a second time.

**Rationale**: FR-011 requires explicit acknowledgement. A dialog would conflict with the inline-only UX ethos of the planilla. An inline expand is consistent with the spreadsheet metaphor.

**Alternatives considered**:
- MUI `Dialog` for acknowledgement — rejected; spec emphasizes inline interaction without dialogs.
- Disabling Confirmar entirely until all inconsistencies are resolved — rejected; FR-011 explicitly allows proceeding with acknowledgement.

---

## Decision 7: Navigation Integration

**Decision**: Add a "Planilla" tab/button alongside the existing navigation on the `/liquidaciones` page, and add the route `/liquidaciones/planilla` under the `(app)` layout group.

**Rationale**: The planilla complements (does not replace) the per-collaborator detail view. Both routes should be discoverable from the same section of the app.
