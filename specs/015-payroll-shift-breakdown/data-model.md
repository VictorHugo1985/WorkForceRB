# Data Model: Daily Shift Breakdown

## Database Changes

**None.** All new data structures are derived at query time from existing tables.

Existing tables used (read-only from this feature's perspective):

| Table | Role |
|---|---|
| `eventos_biometricos_desglosados` | Source of raw punches (`checktime`, `employee_workno`) |
| `codigos_colaborador` | Maps `employee_workno` → `colaborador_id` |
| `dias_liquidacion` | Stores one row per collaborator-day; `horas_calculadas` updated in-place |
| `liquidaciones_semanales` | Week-level container for dias |

---

## TypeScript Type Extensions (in-memory only)

### `Jornada` (new type in `liquidacion.store.ts`)

Represents one complete entry–exit pair within a day.

| Field | Type | Description |
|---|---|---|
| `entrada` | `string` | Local time string `HH:MM` (GMT-4) |
| `salida` | `string` | Local time string `HH:MM` (GMT-4) |
| `horas` | `number` | Duration in hours, rounded to 2 decimal places |

### `DiaLiquidacionData` extensions

Four new fields added to the existing interface:

| Field | Type | Description |
|---|---|---|
| `jornadas` | `Jornada[]` | Ordered list of complete entry–exit pairs for the day |
| `horasParejadas` | `number` | Sum of all paired-shift durations; excludes isolated punch |
| `marcacionSuelta` | `string \| null` | Local time `HH:MM` of the isolated punch, or `null` if none |
| `tieneInconsistencia` | `boolean` | `true` when punch count for the day is odd |

### Derivation rules

```
punches = all checktime values for (colaborador_id, fecha), ordered ascending
pairs = [(punches[0], punches[1]), (punches[2], punches[3]), ...]
jornadas = pairs.map(([e, s]) => { entrada: hhmm(e), salida: hhmm(s), horas: duration(e,s) })
horasParejadas = sum(jornadas.map(j => j.horas))
tieneInconsistencia = punches.length % 2 !== 0
marcacionSuelta = tieneInconsistencia ? hhmm(punches[punches.length - 1]) : null
```

When `punches.length === 0`:
- `jornadas = []`, `horasParejadas = 0`, `tieneInconsistencia = false`, `marcacionSuelta = null`

When `punches.length === 1`:
- `jornadas = []`, `horasParejadas = 0`, `tieneInconsistencia = true`, `marcacionSuelta = hhmm(punches[0])`

---

## `horas_calculadas` Recalculation

**Current behavior**: Stored as `MAX(checktime) − MIN(checktime)` (first-to-last punch, includes breaks).

**New behavior**: Stored as `Σ duration of each complete pair` (excludes break time between shifts).

**Update path**: In `getLiquidacionDetail`, after building jornadas for each day, if `estadoDia = 'SIN_REVISION'` and `horasParejadas ≠ horasCalculadas`, issue:

```sql
UPDATE dias_liquidacion
SET horas_calculadas = $1
WHERE id = $2
```

This self-corrects existing BORRADOR rows on next access, without a batch migration script.

---

## No New API Endpoints

Shift detail is returned as part of the existing `getLiquidacionDetail` payload via `LiquidacionData.dias[].jornadas`. The existing `PATCH /api/dias-liquidacion/:id` route handles corrections unchanged.
