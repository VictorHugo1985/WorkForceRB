# Quickstart: Daily Shift Breakdown — Integration Scenarios

## Scenario 1: Standard Two-Shift Day

**Setup**: Collaborator has 4 punches on Monday: 07:00, 12:00, 13:00, 17:30.

**Expected behavior**:
- Day row shows "Horas Acumuladas: 9.50 h"
- Expanding the row shows:
  - Jornada 1: 07:00 – 12:00 (5.00 h)
  - Jornada 2: 13:00 – 17:30 (4.50 h)
- No inconsistency badge
- `horas_calculadas` in DB = 9.50 (was 10.50 with old MIN/MAX algorithm)

---

## Scenario 2: Single Shift Day

**Setup**: Collaborator has 2 punches: 08:00, 16:00.

**Expected behavior**:
- Day row shows "Horas Acumuladas: 8.00 h"
- Expanding shows: Jornada 1: 08:00 – 16:00 (8.00 h)
- No inconsistency badge

---

## Scenario 3: Isolated Punch (Inconsistency)

**Setup**: Collaborator has 3 punches: 07:00, 12:00, 13:00.

**Expected behavior**:
- Day row shows "Horas Acumuladas: 5.00 h" (from complete pair only)
- Warning chip "Marcación suelta" visible on day row
- Expanding shows:
  - Jornada 1: 07:00 – 12:00 (5.00 h)
  - ⚠ Marcación suelta: 13:00 — sin pareja (excluida del cálculo)
- Clicking "Ajustar" opens DiaAjusteDialog showing:
  - Warning: "Marcación suelta detectada: 13:00"
  - Button "Excluir marcación suelta" pre-fills horas=5.00, motivo="Marcación suelta excluida del cálculo"
- After saving, badge disappears, estadoDia = CON_AJUSTE_HORAS

---

## Scenario 4: Single Isolated Punch

**Setup**: Collaborator has 1 punch: 07:30.

**Expected behavior**:
- Day row shows "Horas Acumuladas: 0.00 h"
- Warning chip visible
- No jornadas in sub-rows
- ⚠ Marcación suelta: 07:30 — sin pareja (excluida del cálculo)
- Reviewer can use DiaAjusteDialog to set hours manually

---

## Scenario 5: Day With No Punches

**Setup**: A day within the week range has no events in `eventos_biometricos_desglosados`.

**Expected behavior**:
- Day row not shown (no `dias_liquidacion` row created for days without events)
- OR if row was pre-created: shows 0.00 h, no shifts, no inconsistency badge

---

## Scenario 6: Re-loading Existing Borrador (Algorithm Migration)

**Setup**: Collaborator had a BORRADOR created with the old MIN/MAX algorithm (e.g., `horas_calculadas = 10.50` for a 4-punch day that should be 9.50 h).

**Expected behavior**:
- On next `getLiquidacionDetail` load:
  - New algorithm computes `horasParejadas = 9.50`
  - Since `estadoDia = 'SIN_REVISION'` and `9.50 ≠ 10.50`, `horas_calculadas` is updated to 9.50 in DB
  - Totals are recalculated
- The UI immediately shows correct 9.50 h

---

## Test Checklist

- [ ] 4-punch day shows 2 jornadas and correct accumulated hours (not first-to-last)
- [ ] 3-punch day shows warning badge and 1 jornada + isolated punch sub-row
- [ ] 1-punch day shows warning badge, 0.00 h accumulated
- [ ] 2-punch day shows 1 jornada, no badge
- [ ] "Excluir marcación suelta" button pre-fills hours=horasParejadas in dialog
- [ ] After saving exclusion, badge disappears and estadoDia = CON_AJUSTE_HORAS
- [ ] Expand/collapse works per day row
- [ ] Rows with 0 punches show no shift detail and no badge
- [ ] Existing MIN/MAX-computed borradores self-correct on reload
- [ ] Approved liquidaciones cannot use the Ajustar button (existing behavior preserved)
