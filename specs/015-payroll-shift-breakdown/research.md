# Research: Daily Shift Breakdown in Weekly Payroll

## Decision 1: Where to Compute Shift Pairing

**Decision**: Compute shift pairs in TypeScript inside `getLiquidacionDetail`, feeding from a batch SQL query on `eventos_biometricos_desglosados`.

**Rationale**: The pairing algorithm (1st–2nd, 3rd–4th, …) is trivial sequential logic. Doing it in a PostgreSQL window function is possible but adds complexity with no performance benefit given the small data volumes per collaborator/week (typically ≤ 30 punches). TypeScript is easier to test and audit.

**Alternatives considered**:
- PostgreSQL array aggregate + TypeScript pairing (chosen — simple, no new indexes)
- PostgreSQL `ROW_NUMBER()` window function partition (rejected — complex CTE for minimal gain)
- Storing parsed jornadas in a new JSONB column (rejected — unnecessary DB migration, data derivable from raw events)

---

## Decision 2: No New DB Migration

**Decision**: `dias_liquidacion` schema is unchanged. `jornadas`, `horasParejadas`, `marcacionSuelta`, and `tieneInconsistencia` are computed fields added to the TypeScript `DiaLiquidacionData` type only, not persisted.

**Rationale**: Constitution Principle I states the base schema must not be modified for new features — only modular extensions. Since all shift data derives from `eventos_biometricos_desglosados` (already in the DB), recomputing it at query time is cheap and avoids a migration.

**Alternatives considered**:
- `dias_liquidacion.marcaciones_json JSONB` column (rejected — migration cost, duplicates existing raw data)

---

## Decision 3: Hour Recalculation Algorithm Change

**Decision**: Replace the MIN/MAX (first-to-last punch) method in `calcularDiasDesdeEventos` with sum-of-paired-shifts (Σ duration of each complete pair).

**Rationale**: The current algorithm includes break time between shifts (e.g., a 1-hour lunch appears as worked time). The correct model is: hours = Σ(exit_i − entry_i) for each paired (entry, exit). This is a correctness fix that makes `horas_calculadas` agree with what the shift breakdown UI will display.

**Migration path**: On the next `getLiquidacionDetail` load for any `BORRADOR` liquidacion, if a `SIN_REVISION` day's stored `horas_calculadas` differs from the newly computed paired value, update it in the same transaction. No manual migration script needed; it self-corrects on access.

---

## Decision 4: Inconsistency Correction Mechanism

**Decision**: Leverage the existing `DiaAjusteDialog` for corrections. When a day has an isolated punch (`tieneInconsistencia = true`), the dialog gains a "Excluir marcación suelta" button that pre-fills `horasAjustadasSupervisor` with `horasParejadas` (hours from complete pairs only) and a default motivo. The reviewer can accept or override before saving.

**Rationale**: Avoids building a new dialog or a new API endpoint. The existing PATCH `/api/dias-liquidacion/:id` route already supports setting `horasAjustadasSupervisor` with `motivoAjuste`, which satisfies Constitution Principle IX (auditability of manual adjustments).

**Alternatives considered**:
- A separate "exclude punch" toggle stored in `dias_liquidacion` (rejected — requires DB column + migration)
- Auto-exclude isolated punches without supervisor action (rejected — violates auditability principle)

---

## Decision 5: UI Rendering of Shift Detail

**Decision**: Render shift detail as sub-rows under each day row in `DiaLiquidacionTable` (expandable on click), rather than a separate column or tooltip.

**Rationale**: Multiple shifts per day need vertical space. A sub-row approach scales gracefully from 0 to N shifts. Days with 0 events collapse to a single line. An inconsistency badge on the day row signals the reviewer without requiring expansion.

**Alternatives considered**:
- Tooltip with shifts list (rejected — not accessible, hard to read 3+ shifts)
- New side panel (rejected — excessive surface area for this data)
- Always expanded (rejected — overwhelming for 7-day view with many complete shifts)

---

## Decision 6: Batch Punch Query

**Decision**: A single SQL query fetches all punches for all days of the collaborator's week using `array_agg(checktime ORDER BY checktime)` grouped by date. TypeScript then iterates per-day arrays to build jornadas.

**Rationale**: One query replaces N per-day queries (N = number of days with events). Keeps `getLiquidacionDetail` latency flat.

```sql
SELECT ebd.checktime::date AS fecha,
       array_agg(ebd.checktime ORDER BY ebd.checktime) AS marcaciones
FROM eventos_biometricos_desglosados ebd
JOIN codigos_colaborador cc
     ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
WHERE cc.colaborador_id = $1
  AND ebd.checktime::date BETWEEN $2 AND $3
GROUP BY ebd.checktime::date
```
