# Tasks: Daily Shift Breakdown in Weekly Payroll

**Feature**: 015-payroll-shift-breakdown
**Plan**: specs/015-payroll-shift-breakdown/plan.md
**Spec**: specs/015-payroll-shift-breakdown/spec.md

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to user story in spec.md (US1 = View Daily Shift Detail, US2 = Detect Isolated Punches, US3 = Correct Inconsistencies)

---

## Phase 1: Setup

**Purpose**: Add the `marcaciones_excluidas` persistence column required by FR-012–015 (per-punch inline exclusion). The original plan said "no DB migration" but that was written before the clarified exclusion requirement. A nullable JSONB column addition is a non-breaking additive change that does not alter existing rows.

- [X] T001 Add `marcaciones_excluidas JSONB DEFAULT NULL` column to `dias_liquidacion` by running SQL: `ALTER TABLE dias_liquidacion ADD COLUMN IF NOT EXISTS marcaciones_excluidas JSONB DEFAULT NULL` (use Supabase dashboard SQL editor or psql via session pooler aws-0-us-east-1.pooler.supabase.com:5432)

**Checkpoint**: Column present — verify with `SELECT column_name FROM information_schema.columns WHERE table_name = 'dias_liquidacion' AND column_name = 'marcaciones_excluidas'`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: TypeScript type extensions and shared data-layer helpers that ALL user story phases depend on.

⚠️ CRITICAL: No user story work can begin until this phase is complete.

- [X] T002 Add `Jornada` interface and extend `DiaLiquidacionData` in `apps/web/src/stores/liquidacion.store.ts`:
  - Add `export interface Jornada { entrada: string; salida: string; horas: number; entradaRaw: string; salidaRaw: string; }` (raw ISO strings needed for punch exclusion PATCH calls)
  - Add to `DiaLiquidacionData`: `jornadas?: Jornada[]; horasParejadas?: number; marcacionSuelta?: string | null; marcacionSueltaRaw?: string | null; tieneInconsistencia?: boolean; marcacionesExcluidas?: string[];`
  - All new fields are optional (`?`) so existing code compiles without changes

- [X] T003 Add `buildJornadas` pure helper in `apps/web/src/lib/liquidacion-db.ts`:
  - Signature: `function buildJornadas(punches: Date[], excludedIso: string[]): { jornadas: Jornada[], horasParejadas: number, marcacionSuelta: string | null, marcacionSueltaRaw: string | null, tieneInconsistencia: boolean }`
  - Filter out any punch whose `.toISOString()` is in `excludedIso` (use a Set for O(1) lookup)
  - Pair remaining punches in strict chronological order: [0,1] = jornada 1, [2,3] = jornada 2, etc.
  - Each jornada: `{ entrada: toHHMM(p[i]), salida: toHHMM(p[i+1]), horas: round2((p[i+1]-p[i])/3600000), entradaRaw: p[i].toISOString(), salidaRaw: p[i+1].toISOString() }`
  - If `punches.length % 2 !== 0`, last punch is isolated: `marcacionSuelta = toHHMM(last)`, `marcacionSueltaRaw = last.toISOString()`, `tieneInconsistencia = true`
  - `horasParejadas = sum of jornada.horas`, rounded to 2 decimal places
  - Add `toHHMM(d: Date): string` private helper that formats date in GMT-4 as `HH:MM`

- [X] T004 Add `fetchPunchMap` helper in `apps/web/src/lib/liquidacion-db.ts`:
  - Signature: `async function fetchPunchMap(client: PoolClient, colaboradorId: string, fechaInicio: string, fechaFin: string): Promise<Map<string, Date[]>>`
  - Runs: `SELECT ebd.checktime::date AS fecha, array_agg(ebd.checktime ORDER BY ebd.checktime) AS marcaciones FROM eventos_biometricos_desglosados ebd JOIN codigos_colaborador cc ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true WHERE cc.colaborador_id = $1 AND ebd.checktime::date BETWEEN $2 AND $3 GROUP BY ebd.checktime::date`
  - Returns `Map<string, Date[]>` keyed by `fecha.toISOString().slice(0,10)` (YYYY-MM-DD)

- [X] T005 Refactor `calcularDiasDesdeEventos` in `apps/web/src/lib/liquidacion-db.ts` to use `fetchPunchMap` + `buildJornadas`:
  - Replace the current `MIN/MAX GROUP BY` query with a call to `fetchPunchMap`
  - For each date entry in the punch map: call `buildJornadas(punches, [])` (no exclusions on initial calculation), use `horasParejadas` as the `horas_calculadas` value
  - The `INSERT INTO dias_liquidacion` logic remains the same; only the `horas_calculadas` value changes

- [X] T006 Refactor `generarBorradoresSemana` in `apps/web/src/lib/liquidacion-db.ts`:
  - Replace the per-colaborador MIN/MAX `GROUP BY cc.colaborador_id, fecha` query with `fetchPunchMap` calls per colaborador (or refactor into a batch variant)
  - Use `buildJornadas` paired-sum instead of `horasEntreMarcaciones` (delete `horasEntreMarcaciones` after T005 and T006 no longer call it)

- [X] T007 Extend `getLiquidacionDetail` in `apps/web/src/lib/liquidacion-db.ts`:
  - Add `marcaciones_excluidas` to the `diasRes` SQL SELECT: `SELECT id, fecha::text, horas_calculadas, horas_ajustadas_supervisor, atraso_detectado, estado_dia, motivo_ajuste, descuento_tipo, descuento_valor, descuento_motivo, marcaciones_excluidas FROM dias_liquidacion WHERE liquidacion_id = $1 ORDER BY fecha`
  - After loading `diasRes`, call `fetchPunchMap(client, colaboradorId, semanaFechas.fechaInicio, semanaFechas.fechaFin)`
  - For each dia row: get `punches = punchMap.get(dia.fecha) ?? []`; get `excluded = (dia.marcaciones_excluidas as string[]) ?? []`; call `buildJornadas(punches, excluded)` to get jornada fields
  - Self-correction: if `dia.estado_dia === 'SIN_REVISION'` and `Math.abs(horasParejadas - Number(dia.horas_calculadas)) > 0.009`, run `UPDATE dias_liquidacion SET horas_calculadas = $1 WHERE id = $2` and recalculate totals once after all such updates
  - Map new fields into returned `DiaLiquidacionData`: `jornadas`, `horasParejadas`, `marcacionSuelta`, `marcacionSueltaRaw`, `tieneInconsistencia`, `marcacionesExcluidas: excluded`

**Checkpoint**: Load any collaborator payroll detail and `console.log(data.dias[0])` — should include `jornadas`, `horasParejadas`, `tieneInconsistencia` fields.

---

## Phase 3: User Story 1 — View Daily Shift Detail (Priority: P1) 🎯 MVP

**Goal**: Every day row shows its entry-exit shifts inline and an "Horas Acumuladas" column with the paired-shift sum.

**Independent Test**: Open a collaborator's payroll with 4 punches on Monday (07:00, 12:00, 13:00, 17:30). Confirm two shift sub-rows appear (Jornada 1: 07:00–12:00, 5.00 h; Jornada 2: 13:00–17:30, 4.50 h) and the day row shows 9.50 h. No inconsistency badge visible.

- [X] T008 [US1] Update `DiaLiquidacionTable.tsx` header and hours column:
  - Rename "Horas Calc." → "Horas Acumuladas"
  - Change displayed value from `dia.horasCalculadas` to `dia.horasAjustadasSupervisor ?? dia.horasParejadas ?? dia.horasCalculadas` (toFixed(2) + " h")
  - Update `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx`

- [X] T009 [US1] Add expand/collapse state to `DiaLiquidacionTable.tsx`:
  - Add `const [expanded, setExpanded] = useState<Set<string>>(new Set())` in component
  - Add leftmost column to `TableHead` row (no header label)
  - In each day `TableRow`, add a first `TableCell` with an expand icon button (`KeyboardArrowRight` / `KeyboardArrowDown` from `@mui/icons-material`); hide the button (render empty cell) when `(dia.jornadas?.length ?? 0) === 0 && !dia.tieneInconsistencia`
  - Toggle `expanded` Set on click
  - Update `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx`

- [X] T010 [US1] Render shift sub-rows under expanded day rows in `DiaLiquidacionTable.tsx`:
  - After each day `TableRow`, conditionally render (when `expanded.has(dia.id)`) one `TableRow` per jornada with:
    - First cell: empty (indented)
    - Second cell (spans 2 cols): `Jornada {N}: {entrada} – {salida}` in `text.secondary` color
    - Duration cell: `({horas.toFixed(2)} h)`
    - Remaining cells: empty (match column count)
  - Use `TableRow sx={{ backgroundColor: 'action.hover' }}` for sub-rows
  - Update `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx`

**Checkpoint**: T008 + T009 + T010 complete → US1 fully testable in browser.

---

## Phase 4: User Story 2 — Detect and Flag Isolated Punches (Priority: P2)

**Goal**: Days with odd punch counts are visually flagged and show the isolated punch in the expanded detail.

**Independent Test**: Open payroll for a collaborator with 3 punches on a day (07:00, 12:00, 13:00). Confirm: (a) "Marcación suelta" warning chip visible on day row; (b) expanding shows Jornada 1: 07:00–12:00 and an isolated punch row at 13:00 in warning color.

- [X] T011 [P] [US2] Add "Marcación suelta" warning `Chip` to day rows in `DiaLiquidacionTable.tsx`:
  - In each day `TableRow`, inside the Estado cell (or after `estadoDiaChip()`), render `{dia.tieneInconsistencia && <Chip label="Marcación suelta" size="small" color="warning" sx={{ ml: 1 }} />}`
  - Update `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx`

- [X] T012 [US2] Add isolated punch sub-row inside expanded day sections in `DiaLiquidacionTable.tsx`:
  - After the last jornada sub-row, when `dia.tieneInconsistencia && dia.marcacionSuelta`, render a `TableRow` with:
    - Warning icon (`WarningAmber` from `@mui/icons-material`) + text `"Marcación suelta: {dia.marcacionSuelta} — sin pareja"` in `color: 'warning.main'`
    - Matching column span
  - Update `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx`

**Checkpoint**: T011 + T012 complete → US2 independently testable in browser (requires US1 expand/collapse from Phase 3).

---

## Phase 5: User Story 3 — Correct Inconsistencies (Priority: P2)

**Goal**: Reviewer can resolve a flagged day by (a) using the DiaAjusteDialog quick-fix for isolated punch, or (b) inline per-punch Omitir/Restaurar with predefined motivo selector.

**Independent Test**: On a flagged 3-punch day — (a) click "Ajustar" → verify quick-fix banner + pre-fill button appear; (b) on a 4-punch day, click "Omitir" on Jornada 1 entry → select "Duplicada" → confirm → verify that punch is strikethrough and hours recalculate to remaining paired sum.

### 5a — DiaAjusteDialog isolated-punch quick-fix

- [X] T013 [US3] Add isolated-punch quick-fix section to `DiaAjusteDialog.tsx`:
  - When `dia.tieneInconsistencia === true`, render at the top of `DialogContent` (before the hours field):
    ```
    <Alert severity="warning" sx={{ mb: 2 }}>
      ⚠ Marcación suelta detectada: {dia.marcacionSuelta}
      <Button size="small" onClick={handleExcluirSuelta}>Excluir marcación suelta</Button>
    </Alert>
    ```
  - `handleExcluirSuelta` calls `setValue('horasAjustadasSupervisor', dia.horasParejadas ?? 0)` and `setValue('motivoAjuste', 'Marcación suelta excluida del cálculo')` — does NOT auto-submit
  - Update `apps/web/src/components/liquidaciones/DiaAjusteDialog.tsx`

### 5b — Per-punch inline exclusion

- [X] T014 [US3] Extend PATCH `/api/dias-liquidacion/[id]` in `apps/web/src/app/api/dias-liquidacion/[id]/route.ts`:
  - Add to `PatchSchema`: `marcacionesExcluidas: z.array(z.string()).optional()`
  - When `dto.marcacionesExcluidas !== undefined`, add `SET marcaciones_excluidas = $N` to the dynamic update (use `JSON.stringify(dto.marcacionesExcluidas)`)
  - Add `marcaciones_excluidas` to the `RETURNING *` projection (already covered by `*`)
  - Update the `json.dia` response mapping in `DiaAjusteDialog` → no change needed since `RETURNING *` includes the new column

- [X] T015 [US3] Add "Omitir" inline action to jornada sub-rows in `DiaLiquidacionTable.tsx`:
  - For each jornada sub-row, add action cells with a small "Omitir" `Button`; when clicked, set `pendingOmit` state to `{ diaId: dia.id, punchIso: jornada.entradaRaw }` (or `salidaRaw` — use a per-punch "Omitir" for each individual punch)
  - When `pendingOmit` matches a punch, show an inline compact `Select` (options: "Duplicada", "Error de registro", "Otro") + "Confirmar" button
  - On confirm: `PATCH /api/dias-liquidacion/{dia.id}` with `{ marcacionesExcluidas: [...(dia.marcacionesExcluidas ?? []), punchIso] }`; on success call `reconcileDia(json.dia)` and `applyOptimisticTotales(json.totales)` from Zustand store
  - Import `useLiquidacionStore` for store actions; the `isAprobado` guard must disable the Omitir button
  - Update `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx`

- [X] T016 [US3] Style excluded punches and add "Restaurar" action in `DiaLiquidacionTable.tsx`:
  - In `buildJornadas` result, excluded punches are already filtered out of `jornadas[]`. To display them with strikethrough: add `excludedJornadas` concept — after calling `buildJornadas`, also compute the excluded punches by checking which punches from the raw array were filtered out; expose them as a separate visual row group
  - Render each excluded punch as a sub-row with: strikethrough text (`textDecoration: 'line-through'`, `color: 'text.disabled'`), timestamp display, and "Restaurar" button
  - "Restaurar" sends `PATCH` with `marcacionesExcluidas: dia.marcacionesExcluidas.filter(t => t !== punchIso)`; on success reconcile store
  - Update `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx`

- [X] T017 [US3] Update `getLiquidacionDetail` dia mapping to expose excluded punch display data in `apps/web/src/lib/liquidacion-db.ts`:
  - After calling `buildJornadas(punches, excluded)`, also compute `excludedPunchDisplay: Array<{ iso: string; hhmm: string }>` from `punches.filter(p => excluded.includes(p.toISOString()))` to give the UI the HH:MM display strings for excluded punches
  - Add `excludedPunchDisplay` to `DiaLiquidacionData` in `liquidacion.store.ts` and include in `getLiquidacionDetail` mapping

**Checkpoint**: All Phase 5 tasks complete → US3 independently testable in browser.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Manually validate all 10 quickstart.md test scenarios in browser (4-punch day, 3-punch day, 1-punch day, 2-punch day, 0-punch day, reload BORRADOR self-correction, expand/collapse, badge disappears after save, existing MIN/MAX borradores, approved liquidacion disabled state)
- [ ] T019 [P] Verify `isAprobado` guard disables all new buttons (expand toggle still works, but Omitir/Restaurar buttons are `disabled={isAprobado}` in `DiaLiquidacionTable.tsx`)
- [ ] T020 [P] Verify `generarBorradoresSemana` uses paired-shift hours by creating a test semana and checking stored `horas_calculadas` matches sum-of-pairs (not first-to-last)
- [ ] T021 Verify that after saving a punch exclusion via "Omitir", the `tieneInconsistencia` flag recalculates correctly on the next load (even number of remaining punches → no badge)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 — BLOCKS all user story phases
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 3 (expand/collapse state from T009 must exist for isolated punch sub-row)
- **US3 (Phase 5)**: Depends on Phase 4 (inconsistency state must be visible before correction UX)
- **Polish (Phase 6)**: Depends on all Phase 3–5 tasks

### Within Phase 2

- T002 → T003 → T004 → T005 → T006 → T007 (strict sequential: each depends on previous types/helpers)

### Within Phase 5

- T013 is independent of T014–T017 (different file)
- T014 must complete before T015 and T016 (API must accept exclusions before UI sends them)
- T017 should complete alongside T014 (both affect liquidacion-db.ts and store types)

### Parallel Opportunities

- Phase 4: T011 [P] and T012 can start simultaneously (different sections of the same file)
- Phase 6: T018, T019, T020 can run in parallel

---

## Parallel Example: Phase 4

```
# Both can start in parallel after Phase 3 is complete:
Task T011: Add "Marcación suelta" chip to day row header area
Task T012: Add isolated punch sub-row to expanded detail section
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 — Add DB column
2. T002–T007 — Data layer (foundational)
3. T008–T010 — US1: Inline shift display
4. **STOP and VALIDATE** in browser — shifts visible, hours correct, no badge yet
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + Phase 2 → Data layer ready
2. Phase 3 → US1: Shift visibility ✓ (MVP)
3. Phase 4 → US2: Inconsistency flagging ✓
4. Phase 5 → US3: Correction flow ✓
5. Phase 6 → Full validation ✓

---

## Notes

- `buildJornadas` must build an ISO string Set from `excludedIso` for O(1) lookup when filtering punches
- The punch ISO string stored in `marcacionesExcluidas` is `punch.toISOString()` (full UTC precision) — NOT the `HH:MM` display string
- `toHHMM` helper must apply GMT-4 offset (subtract 4 hours from UTC) to match the rest of the app's Venezuela timezone convention
- Self-correction in `getLiquidacionDetail` batches all SIN_REVISION updates before recalculating totals once (avoid multiple `calcularTotales` calls)
- Excluded punches are stored as a JSON array of ISO strings in `dias_liquidacion.marcaciones_excluidas`; an empty array and NULL are treated identically (no exclusions)
- Total task count: **21 tasks** (T001–T021)
