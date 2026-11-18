# Feature Specification: Weekly Payroll Planilla (Spreadsheet View)

**Feature Branch**: `016-payroll-planilla`

**Created**: 2026-05-30

**Status**: Draft

**Input**: User description: "Vista planilla semanal de liquidaciones estilo Excel: mostrar todos los colaboradores con horas > 0 en la semana seleccionada, agrupados por colaborador con una fila por día mostrando ENT.1/SAL.1/ENT.2/SAL.2 (jornadas del dia), horas acumuladas por dia editables inline con persistencia (click en celda → editar → guardar sin dialog), y confirmacion/aprobacion por colaborador al final de su bloque de dias."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Weekly Planilla (Priority: P1)

A payroll manager selects a work week and immediately sees a single spreadsheet-style table listing every collaborator who registered at least one hour during that week. Each collaborator occupies a block of rows — one row per worked day — showing the individual entry/exit pairs (ENT.1/SAL.1, ENT.2/SAL.2, and so on for days with more than two shifts), and an accumulated-hours cell for that day. A summary row at the bottom of each collaborator block shows their weekly total hours, hourly rate, and total payment amount.

**Why this priority**: This is the core visibility improvement. Without a unified planilla view, the reviewer must open each collaborator's detail page individually, which is slow and error-prone across a full team.

**Independent Test**: Select any work week that has biometric events. Verify the planilla loads showing only collaborators with > 0 hours, each with the correct day rows and shift columns.

**Acceptance Scenarios**:

1. **Given** a week with 5 collaborators having hours and 2 with zero hours, **When** the planilla is opened for that week, **Then** exactly 5 collaborator blocks are shown and the 2 zero-hour collaborators are absent.
2. **Given** a collaborator with 4 punches on Monday (two shifts) and 2 punches on Wednesday (one shift), **When** the planilla row for that collaborator is viewed, **Then** Monday shows ENT.1/SAL.1 and ENT.2/SAL.2 populated, and Wednesday shows only ENT.1/SAL.1 with ENT.2/SAL.2 blank.
3. **Given** a collaborator with 3 punches on a day (inconsistency), **When** that row is displayed, **Then** the day row is visually flagged with a warning indicator.
4. **Given** a week with no biometric events at all, **When** the planilla is opened, **Then** an empty-state message is shown.

---

### User Story 2 - Inline Hour Adjustment (Priority: P2)

A payroll manager clicks directly on the accumulated-hours cell for any day row in the planilla. The cell becomes editable in place — no dialog opens. The manager types the corrected hours value, provides a brief adjustment reason in a small inline field that appears alongside, and confirms with Enter or by clicking away. The cell immediately shows the new value and the collaborator's weekly total updates accordingly.

**Why this priority**: Inline editing eliminates the repetitive open-dialog → fill form → close cycle that slows bulk corrections. With a planilla of 20+ collaborators it saves minutes per payroll period.

**Independent Test**: Click the hours cell for any SIN_REVISION day in the planilla. Verify the cell enters edit mode, accepts a new value, requires a motivo, saves on Enter, and the collaborator total row updates without a page reload.

**Acceptance Scenarios**:

1. **Given** a SIN_REVISION day row, **When** the reviewer clicks the hours cell, **Then** the cell becomes an editable number field and a motivo input appears inline next to it.
2. **Given** an open hours cell with a new value and motivo entered, **When** the reviewer presses Enter, **Then** the value is saved, the cell returns to display mode, and the collaborator's weekly total row refreshes.
3. **Given** an open hours cell, **When** the reviewer presses Escape, **Then** the original value is restored and no save occurs.
4. **Given** a day belonging to an already-confirmed collaborator, **When** the reviewer attempts to click the hours cell, **Then** the cell remains non-editable.
5. **Given** a motivo field left empty, **When** the reviewer tries to confirm, **Then** the save is blocked and the motivo field is highlighted as required.

---

### User Story 3 - Per-Collaborator Confirmation (Priority: P2)

After reviewing a collaborator's week in the planilla, the payroll manager clicks a "Confirmar" button at the bottom of that collaborator's block. This approves all days for that collaborator and marks their liquidación as APROBADO. The collaborator block becomes visually locked (read-only), and the confirmation button changes to a "✓ Aprobado" indicator. Other collaborators in the same planilla are unaffected.

**Why this priority**: Per-collaborator confirmation allows the manager to approve collaborators one by one as they review them, without having to finish the entire week before saving any progress.

**Independent Test**: With two collaborators in the planilla, confirm one. Verify only that collaborator's block locks and shows "✓ Aprobado"; the other remains editable.

**Acceptance Scenarios**:

1. **Given** a collaborator block with all days in a reviewable state, **When** the reviewer clicks "Confirmar", **Then** the liquidación becomes APROBADO, the block becomes read-only, and the button shows "✓ Aprobado".
2. **Given** a collaborator block with at least one day still showing an unresolved inconsistency flag, **When** the reviewer clicks "Confirmar", **Then** a warning is shown and the reviewer must explicitly acknowledge before proceeding.
3. **Given** an already-confirmed collaborator block, **When** the planilla is reloaded, **Then** the block remains in read-only/APROBADO state.
4. **Given** multiple collaborators in the planilla, **When** one is confirmed, **Then** the remaining collaborators are unaffected and still editable.

---

### Edge Cases

- What if a collaborator has shifts on only one day of the week? Their block shows a single day row plus the summary row.
- What if a day has more than 4 punches (3+ shifts)? Additional ENT/SAL columns are shown; the column count adapts to the maximum number of shifts across all visible rows for that week.
- What if a day has previously manually adjusted hours? The hours cell shows the adjusted value with an "Ajustado" indicator; the original biometric hours remain visible as a reference.
- What if the inline edit save fails server-side? The cell reverts to the previous value and an inline error message appears.
- What if a collaborator has punches on some days but zero total paired hours (all isolated punches)? They still appear in the planilla since they have biometric activity requiring review.
- What if all collaborators for a week are already confirmed? The planilla shows all blocks in read-only state with a "Semana completa" indicator.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The planilla view MUST display all collaborators with at least one biometric punch during the selected week, grouped by collaborator, one row per worked day.
- **FR-002**: Each day row MUST show entry/exit pairs as labeled columns (ENT.1/SAL.1, ENT.2/SAL.2, etc.) up to the maximum shift count found across all collaborators for that week.
- **FR-003**: Each day row MUST include an accumulated-hours cell showing the sum of completed paired shifts for that day.
- **FR-004**: Days with manually adjusted hours MUST display the adjusted value with a visible "Ajustado" indicator; the original biometric hours MUST remain visible as a reference.
- **FR-005**: Days with inconsistent punch counts MUST display a warning indicator on the day row.
- **FR-006**: The hours cell for any non-confirmed day MUST become an inline editable number field when clicked, with an adjacent inline motivo input — no dialog.
- **FR-007**: The inline edit MUST save on Enter or focus-loss confirmation, and cancel without saving on Escape.
- **FR-008**: A motivo MUST be required to save an inline hour adjustment; saving with an empty motivo MUST be blocked.
- **FR-009**: Each collaborator block MUST include a summary row showing: total weekly hours, hourly rate, and total payment in Bs.
- **FR-010**: Each collaborator block MUST include a "Confirmar" button that approves the collaborator's entire week liquidación in one action.
- **FR-011**: When confirming a collaborator block that has unresolved inconsistency flags, the system MUST warn the reviewer and require explicit acknowledgement before saving.
- **FR-012**: After confirmation, the entire collaborator block MUST become read-only; all editable cells and the Confirmar button MUST be disabled.
- **FR-013**: The planilla MUST include a week selector showing all `semanas_laborales` ordered by date descending. The most recent ABIERTA week MUST be selected by default on first load. Selecting a different week reloads the planilla data. The collaborator name in each block MUST be a link that opens the collaborator's detail page (`/liquidaciones/[semanaId]/[colaboradorId]`) in a new tab.
- **FR-014**: Collaborators with zero hours for the selected week MUST NOT appear in the planilla.
- **FR-015**: The planilla MUST remain responsive with up to 30 collaborators and 7 days per week.

### Key Entities

- **Planilla**: The weekly spreadsheet view aggregating all collaborator liquidaciones for a given work week. Composed from existing liquidation and biometric data — not a new stored entity.
- **Collaborator Block**: The group of rows in the planilla belonging to one collaborator: day rows + summary row + confirmation action.
- **Day Row**: A single row representing one collaborator's worked day — shift columns, hours cell, inconsistency indicator.
- **Summary Row**: The bottom row of each collaborator block showing weekly totals (hours, rate, total Bs.) and the Confirmar button.
- **Inline Edit**: The in-place editing interaction on the hours cell — click to activate, Enter/blur to confirm, Escape to cancel, motivo required.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A payroll manager can review and confirm all collaborators for a full work week without opening any individual collaborator detail page.
- **SC-002**: Reviewing and confirming one collaborator's week (no inconsistencies) takes under 30 seconds from landing on the planilla.
- **SC-003**: An inline hour adjustment — including motivo entry and confirmation — completes in under 10 seconds.
- **SC-004**: The planilla loads fully for a week with 30 collaborators in under 4 seconds.
- **SC-005**: 100% of confirmed collaborator blocks retain their APROBADO state and read-only display after a page reload.
- **SC-006**: Inconsistent days (odd punch count) are flagged in 100% of cases, consistent with feature 015 behavior.

## Clarifications

### Session 2026-06-01

- Q: ¿Cómo debe estructurarse el renderizado de la planilla? → A: Mediante un componente `LiquidacionColaborador` por usuario que se carga dinámicamente — la vista instancia un componente por cada colaborador activo y cada uno gestiona su propio ciclo de datos de forma independiente.
- Q: ¿"Todos los usuarios activos" implica mostrar colaboradores con 0 horas en la planilla, o solo instanciar dinámicamente los que tienen horas en la semana? → A: Solo los colaboradores con al menos un punch en la semana seleccionada — la vista instancia un `LiquidacionColaborador` por cada uno encontrado; "activos" describe la arquitectura de carga dinámica, no un cambio al filtro de > 0 horas.
- Q: ¿La planilla reemplaza la ruta `/liquidaciones` o va en una nueva ruta? → A: La planilla va en `/liquidaciones` — reemplaza la vista de lista actual; esa ruta pasa a ser directamente la planilla.
- Q: ¿El nombre del colaborador en la planilla enlaza a su vista detalle? → A: Sí — el nombre del colaborador es un link que abre `/liquidaciones/[semanaId]/[colaboradorId]` en pestaña nueva.
- Q: ¿Qué semanas muestra el selector y cuál es la selección por defecto? → A: Muestra todas las `semanas_laborales` ordenadas por fecha desc; la semana ABIERTA más reciente se selecciona por defecto al entrar.

## Assumptions

- The planilla lives at `/liquidaciones`, replacing the current collaborator-list view at that route. The existing per-collaborator detail page (`/liquidaciones/[semanaId]/[colaboradorId]`) remains available for deep inspection.
- Week selection reuses the existing `semanas_laborales` data; no new period management logic is needed.
- Shift pairing logic (ENT.1/SAL.1 derivation) is the same algorithm from feature 015; the planilla reads the same computed data.
- A "worked day" is any calendar day within the week range where the collaborator has at least one biometric punch.
- The hourly rate in the summary row is the collaborator's active `tarifa_hora` rule as of the week's end date.
- Saturday is treated the same as any weekday; special half-day Saturday rules are out of scope.
- The planilla is accessible to ADMINISTRADOR and SUPERVISOR roles only.
- Bulk "Confirmar todos" (approve entire week for all collaborators at once) is out of scope; per-collaborator only.
- The maximum number of ENT/SAL columns shown adapts dynamically to the selected week's data — not fixed at 2 shifts.
- A collaborator appearing in the planilla with only isolated punches (zero paired hours) still needs review, so they are shown.
