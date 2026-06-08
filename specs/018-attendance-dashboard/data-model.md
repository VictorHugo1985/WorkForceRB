# Data Model: Attendance Dashboard

**No new tables or schema changes are required for this feature.**

The dashboard is a read-only query over existing tables. All entities are already in production.

---

## Entities Used

### colaboradores
The central entity. All active collaboradores appear on the dashboard regardless of whether they have attendance events.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| nombre | text | Given name |
| apellido | text | Surname |
| cedula | text | National ID (used for search) |
| area_id | UUID FK → areas | Nullable; colaboradores without an area appear under "Sin área" |
| activo | boolean | Only `activo = true` are shown on the dashboard |

### areas
Organizational groupings. Each area card on the dashboard corresponds to one row.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| nombre | text | Display name; shown as card title |

### eventos_biometricos_desglosados
Source of attendance truth. Each row is a single biometric punch event.

| Column | Type | Notes |
|--------|------|-------|
| evento_id | text | Unique event identifier (dedup key) |
| checktime | timestamptz | UTC timestamp of the punch event |
| utc_offset | integer | Offset in hours to derive local time (-4 for Bolivia) |
| employee_workno | text | Biometric device employee code (joins via codigos_colaborador) |
| checktype | text | Punch type (I/O) |

**Local time derivation**: `checktime + make_interval(hours => utc_offset)` — no JS date math needed.

### codigos_colaborador
Maps biometric device employee codes to system colaborador IDs.

| Column | Type | Notes |
|--------|------|-------|
| colaborador_id | UUID FK → colaboradores | |
| codigo_biometrico | text | Matches `employee_workno` on biometric events |
| activo | boolean | Only active codes are included in queries |

---

## Query Pattern

The dashboard query (already implemented in `apps/web/src/app/api/dashboard/asistencia/route.ts`) uses:

```
CTE "eventos":
  For each (colaborador_id, local_date) pair:
    - Filter eventos_biometricos_desglosados by local date range using utc_offset
    - Aggregate marcaciones (HH:MM strings) into an array per day

Main query:
  LEFT JOIN "eventos" onto all active colaboradores
  → Colaboradores with no events still appear (as absent)
  GROUP BY colaborador, area
  ORDER BY area.nombre, colaborador.apellido, colaborador.nombre
```

Result shape per collaborador:
```json
{
  "id": "uuid",
  "nombre": "string",
  "apellido": "string",
  "dias": [
    { "fecha": "YYYY-MM-DD", "marcaciones": ["HH:MM", "HH:MM"] }
  ]
}
```

`dias` is an empty array `[]` for absent collaboradores.

---

## State Transitions

Not applicable — dashboard is read-only. No writes.

---

## Outstanding Gap: Auto-Refresh

**FR-014 / Constitution Principle X** requires ≤60 second latency for the "active attendance view" (today's filter).

**Implementation needed** (not yet in code):
- When the active quick filter is "Hoy", a 60-second `setInterval` re-fires the fetch.
- The interval is cleared when the filter changes away from "Hoy" or the component unmounts.
- This is a pure frontend change to `DashboardClient.tsx`. No backend changes.
