# Feature Specification: Daily Shift Breakdown in Weekly Payroll

**Feature Branch**: `015-payroll-shift-breakdown`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "En la weekly-payroll mostrar por cada dia, las jornadas trabajadas (por ej: 1era entrada a 1era salida , 2da entrada a 2da salida, puede que haya mas de 2 jornadas en un dia) y agregar una columna con las horas acumuladas por dia. Asi al gestionar un periodo de payroll tenemos visibilidad de todas las horas por dia (con su detalle). Si hubiera alguna hora suelta , tiene que mostrar la incosistencia para que se corrija en esa vista."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Daily Shift Detail (Priority: P1)

A payroll reviewer opens a weekly payroll period for a collaborator and sees each worked day broken down into individual shifts. Each shift shows its start and end time (e.g., 07:00–12:00, 13:00–17:30). Days with more than two shifts are fully listed. The accumulated hours column on each day row reflects the total time across all shifts for that day.

**Why this priority**: This is the core visibility improvement. Without it, the payroll reviewer cannot audit whether hours were correctly computed and from which time intervals.

**Independent Test**: Open any collaborator's payroll detail for a week where biometric events exist. Verify each day row expands or shows all entry-exit pairs with correct timestamps, and the hours column matches the sum of paired durations.

**Acceptance Scenarios**:

1. **Given** a day with punches at 07:00, 12:00, 13:00, 17:30, **When** the payroll detail is displayed, **Then** two shifts are shown: "07:00 – 12:00" (5 h) and "13:00 – 17:30" (4.5 h), and the accumulated hours column shows 9.5 h.
2. **Given** a day with a single shift (08:00 – 16:00), **When** the payroll detail is displayed, **Then** one shift row appears: "08:00 – 16:00" (8 h), and the accumulated hours column shows 8 h.
3. **Given** a day with three shifts (morning, midday, afternoon), **When** the payroll detail is displayed, **Then** all three pairs are listed in chronological order.
4. **Given** a day with no biometric events, **When** the payroll detail is displayed, **Then** the day row shows "—" for shifts and 0 h accumulated.

---

### User Story 2 - Detect and Flag Isolated Punches (Priority: P2)

When a collaborator's biometric record for a given day contains an odd number of punches (e.g., three punches instead of two or four), the remaining unpaired punch cannot form a complete shift. The payroll view visually flags that day as inconsistent and shows which punch is isolated (its time and position in the sequence). The reviewer understands at a glance that correction is needed.

**Why this priority**: Without inconsistency detection, payroll errors caused by missed punches go unnoticed until payment disputes arise.

**Independent Test**: Open a payroll detail for a collaborator with a day that has 3 punches. Verify a warning indicator appears on that day row with a description of the inconsistency (e.g., "1 marcación sin pareja").

**Acceptance Scenarios**:

1. **Given** a day with 3 punches (07:00, 12:00, 13:00), **When** the payroll detail is displayed, **Then** the day is flagged with a warning, the first two form a shift (07:00–12:00), and the third punch (13:00) is shown as isolated with a label such as "sin pareja".
2. **Given** a day with 1 punch only, **When** the payroll detail is displayed, **Then** the day is flagged, no shift is formed, accumulated hours show 0 h, and the single punch is highlighted as isolated.
3. **Given** a day with an even number of punches (2, 4, 6…), **When** the payroll detail is displayed, **Then** no inconsistency flag is shown.

---

### User Story 3 - Correct Inconsistencies in the Payroll View (Priority: P2)

When a day is flagged as inconsistent, the payroll reviewer can resolve it directly within the payroll view by either: (a) excluding the isolated punch from the calculation, or (b) overriding the total hours for that day manually. After correction the inconsistency flag disappears and the accumulated hours update.

**Why this priority**: Detection without correction is incomplete. The reviewer must be able to fix the record without leaving the payroll workflow.

**Independent Test**: On a flagged inconsistent day, apply a manual correction (exclude isolated punch or set hours manually). Verify the flag clears and the accumulated hours column updates to reflect the correction.

**Acceptance Scenarios**:

1. **Given** a flagged day with an isolated punch, **When** the reviewer chooses to exclude the isolated punch, **Then** the hours are recalculated using only the complete pairs, the flag disappears, and the change is saved.
2. **Given** a flagged day, **When** the reviewer manually overrides the daily hours, **Then** the new value replaces the calculated one, the inconsistency is acknowledged/resolved, and the change persists on reload.
3. **Given** a corrected day, **When** the reviewer reloads the payroll view, **Then** the correction is retained and no inconsistency flag appears.

---

### Edge Cases

- What happens when all punches on a day are isolated (odd-count days)? All form as many complete pairs as possible and the remainder is flagged.
- What if a punch is recorded on the boundary of two calendar days (e.g., 23:58 and 00:03 next day)? Each punch is attributed to its respective calendar date; the overnight gap is not counted as a shift unless both punches fall on the same day.
- What if a collaborator has no biometric code assigned? The day shows no punches and no shift data.
- What if a day has been manually adjusted previously? The manual adjustment value prevails for the accumulated hours column, and a note indicates it was manually set.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The payroll day view MUST show each day's biometric punches grouped into chronological entry-exit pairs (shifts), displayed as time intervals (e.g., "08:00 – 12:30").
- **FR-002**: Shifts within a day MUST be listed in chronological order of start time.
- **FR-003**: The payroll day view MUST include an "Horas acumuladas" column per day that sums the duration of all complete shifts for that day.
- **FR-004**: When a day has an odd number of punches, the system MUST flag that day with a visible inconsistency indicator and identify which punch(es) are unpaired.
- **FR-005**: The pairing algorithm MUST pair punches in strict chronological order: first punch = entry, second = exit, third = entry for second shift, and so on.
- **FR-006**: Isolated (unpaired) punches MUST be shown with a distinct visual marker (e.g., warning color, icon) and a label indicating they lack a pair.
- **FR-007**: The reviewer MUST be able to resolve an inconsistency by overriding the day's hours manually within the payroll view.
- **FR-008**: The reviewer MUST be able to resolve an inconsistency by marking the isolated punch as excluded, causing the system to recalculate using only complete pairs.
- **FR-009**: After a correction is saved, the inconsistency flag for that day MUST be cleared.
- **FR-010**: Days with zero punches MUST display 0 accumulated hours with no shifts listed and no inconsistency flag.
- **FR-011**: Days that were previously manually adjusted MUST display the manually set hours and indicate the override is active.

### Key Entities

- **Shift**: A pair of consecutive biometric punches (entry time + exit time) forming a single work interval within a day. Derived from raw punch data.
- **Isolated Punch**: A biometric punch that cannot be paired because the total punch count for that day is odd; always the last chronological punch in the sequence.
- **Daily Inconsistency**: A state where a day has one or more isolated punches, requiring reviewer attention and correction.
- **Day Override**: A manually set hours value for a day that replaces the automatically calculated total; applied by the reviewer when correcting inconsistencies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any collaborator with biometric data, the payroll reviewer can identify all shifts worked on each day without opening any additional screen — full detail visible in the payroll day table.
- **SC-002**: Days with inconsistent punch counts (odd number) are automatically flagged in 100% of cases with no manual identification required.
- **SC-003**: A reviewer can resolve a flagged inconsistency and save the correction in under 60 seconds from first noticing the flag.
- **SC-004**: The accumulated hours column value matches the sum of displayed shift durations for every complete (non-flagged) day.
- **SC-005**: After correcting an inconsistency and reloading the view, 100% of corrections are retained — no data loss on refresh.

## Assumptions

- Pairing follows strict chronological order; the system does not attempt to infer entry/exit from the punch type (`tipo_evento`), since punch type may be incorrect. Time order is the sole authority.
- A day is defined by the local calendar date in the GMT-4 timezone (Venezuela time), consistent with the rest of the application.
- The existing payroll detail view (`DiaLiquidacionTable`) is the surface where shift detail is added; this feature enhances that component rather than introducing a new page.
- Correction of isolated punches leverages the existing manual override mechanism (`DiaAjusteDialog`) already present in the payroll view.
- Excluded/ignored isolated punches are recorded as an override decision so the correction survives recalculation.
- This feature covers the payroll review period only — it does not modify raw biometric event records.
