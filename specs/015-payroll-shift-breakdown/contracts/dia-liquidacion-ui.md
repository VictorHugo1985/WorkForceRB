# UI Contract: DiaLiquidacionTable — Shift Breakdown

## Row Structure

Each `DiaLiquidacionData` renders as a **collapsible row group** in `DiaLiquidacionTable`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ▶  Fecha  │  Horas Acumuladas  │  Horas Ajust.  │  Estado  │  Acciones │
│    27/05  │       9.50 h       │       —        │ Sin rev. │  [Ajustar]│
│           └─ Jornada 1: 07:00 – 12:00  (5.00 h)                        │
│           └─ Jornada 2: 13:00 – 17:30  (4.50 h)                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Day row (collapsed, default)

| Column | Content |
|---|---|
| Expand icon | `▶` / `▼` toggle; hidden if `jornadas.length === 0` and not `tieneInconsistencia` |
| Fecha | `DD/MM` formatted |
| Horas Acumuladas | `horasAjustadasSupervisor ?? horasCalculadas`, shown to 2 dp with "h" suffix |
| Horas Ajust. | `horasAjustadasSupervisor` if set, else `—` |
| Estado | Existing `estadoDiaChip()` |
| Inconsistencia badge | Warning `Chip` with label "Marcación suelta" visible when `tieneInconsistencia = true` |
| Acciones | "Ajustar" button (existing) |

### Shift sub-rows (visible when expanded)

Each entry in `jornadas[]` renders a sub-row:

| Column | Content |
|---|---|
| — | Indent marker (no expand icon) |
| Label | `Jornada N` where N = 1-based index |
| Time range | `HH:MM – HH:MM` |
| Duration | `(X.XX h)` |

### Isolated punch sub-row (when `tieneInconsistencia`)

```
⚠  Marcación suelta: 13:47 — sin pareja (excluida del cálculo)
```

Rendered in warning color (`warning.main`). Always visible when day is expanded.

---

## DiaAjusteDialog: Inconsistency Quick-Fix

When `dia.tieneInconsistencia === true`, the dialog shows an additional section above the hours field:

```
┌──────────────────────────────────────────────┐
│ ⚠  Marcación suelta detectada: 13:47         │
│                                              │
│ [Excluir marcación suelta]                   │
│ Completa las jornadas pareadas: 5.00 h       │
└──────────────────────────────────────────────┘
```

**"Excluir marcación suelta" button behavior**:
1. Sets `horasAjustadasSupervisor` field to `dia.horasParejadas`
2. Sets `motivoAjuste` field to `"Marcación suelta excluida del cálculo"`
3. Does NOT auto-submit — reviewer can still review and modify before saving

---

## State Transitions

```
tieneInconsistencia=true + no override → WARNING badge visible, horasCalculadas shows paired hours
tieneInconsistencia=true + override applied → flag disappears (estadoDia = CON_AJUSTE_HORAS)
tieneInconsistencia=false → no badge, normal display
```

Note: once `horasAjustadasSupervisor` is set (by excluding isolated punch or any manual override), `estadoDia` becomes `CON_AJUSTE_HORAS` and the inconsistency badge is hidden — the day is considered reviewed.
