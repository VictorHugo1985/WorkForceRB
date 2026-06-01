# API Contracts: Weekly Payroll Planilla

**Feature**: 016-payroll-planilla | **Date**: 2026-06-01

---

## New Endpoints

### GET /api/planilla/[semanaId]

Returns the roster of collaborators with biometric activity in the selected week, plus the week-global maximum shift count needed to size the ENT/SAL column grid.

**Auth**: ADMINISTRADOR or SUPERVISOR role required (same as all liquidacion routes).

**Path param**: `semanaId` — UUID of the `semanas_laborales` record.

**Response 200**:
```json
{
  "semana": {
    "id": "uuid",
    "fechaInicio": "2026-05-23",
    "fechaFin": "2026-05-29",
    "estado": "ABIERTA"
  },
  "maxShifts": 2,
  "colaboradores": [
    {
      "liquidacionId": "uuid",
      "colaboradorId": "uuid",
      "nombre": "Julia Rivero",
      "estado": "BORRADOR"
    }
  ]
}
```

- `maxShifts`: global maximum number of paired shifts across any day and any collaborator for this week. Drives ENT.1/SAL.1…ENT.N/SAL.N column count.
- `colaboradores`: sorted by apellido, nombre. Only collaborators with ≥ 1 punch in the week.
- `estado`: `BORRADOR` | `APROBADO` — used to pre-render confirmed blocks as read-only.

**Response 404**: Semana not found.

**Response 200 (empty week)**:
```json
{ "semana": {...}, "maxShifts": 0, "colaboradores": [] }
```

---

### GET /api/liquidaciones/[id]

Returns full liquidacion detail for a single `liquidaciones_semanales` record, including enriched day rows with jornadas and pairing data.

**Auth**: ADMINISTRADOR or SUPERVISOR role; SUPERVISOR scope-checked against colaborador.

**Path param**: `id` — UUID of the `liquidaciones_semanales` record.

**Response 200** — same shape as `getLiquidacionDetail` output:
```json
{
  "id": "uuid",
  "colaboradorId": "uuid",
  "semanaId": "uuid",
  "estado": "BORRADOR",
  "horasOrdinarias": 40,
  "horasExtra": 2.5,
  "valorHorasOrdinarias": 200.00,
  "valorHorasExtra": 12.50,
  "totalBonos": 0,
  "totalDescuentos": 0,
  "totalPago": 212.50,
  "calculadoEn": "2026-05-30T12:00:00Z",
  "aprobadoPor": null,
  "aprobadaEn": null,
  "dias": [
    {
      "id": "uuid",
      "fecha": "2026-05-23",
      "horasCalculadas": 8.0,
      "horasAjustadasSupervisor": null,
      "estadoDia": "SIN_REVISION",
      "motivoAjuste": null,
      "descuentoTipo": null,
      "descuentoValor": null,
      "descuentoMotivo": null,
      "atrasoDetectado": false,
      "jornadas": [
        { "entrada": "08:00", "salida": "12:00", "horas": 4.0, "entradaRaw": "...", "salidaRaw": "..." },
        { "entrada": "13:00", "salida": "17:00", "horas": 4.0, "entradaRaw": "...", "salidaRaw": "..." }
      ],
      "horasParejadas": 8.0,
      "marcacionSuelta": null,
      "tieneInconsistencia": false,
      "marcacionesExcluidas": [],
      "excludedPunchDisplay": []
    }
  ],
  "bonos": []
}
```

**Response 404**: Liquidacion not found.

---

## Existing Endpoints (reused unchanged)

### PATCH /api/dias-liquidacion/[id]

Used by inline hour adjustment. Already accepts `horasAjustadasSupervisor` + `motivoAjuste`.

**Body for inline edit**:
```json
{
  "horasAjustadasSupervisor": 7.5,
  "motivoAjuste": "Salida anticipada autorizada"
}
```

**Response 200**: `{ "dia": DiaLiquidacionData, "totales": TotalesData }`

---

### POST /api/liquidaciones/[id]/aprobar

Used by per-collaborator "Confirmar" button. No body required.

**Response 200**: Updated liquidacion record with `estado: "APROBADO"` and totales.

**Response 409**: Already approved.

---

### GET /api/semanas-laborales

Used by week selector to populate the dropdown.

**Response 200**: `[{ "id", "fecha_inicio", "fecha_fin", "estado" }]` sorted DESC by fecha_inicio.

---

## Frontend Component Props Contracts

### PlanillaView

```typescript
// No props — fetches everything internally
// Internal state: selectedSemanaId, semanasLaborales[], colaboradores[]
```

### LiquidacionColaborador

```typescript
interface LiquidacionColaboradorProps {
  liquidacionId: string;
  colaboradorId: string;
  nombre: string;
  semanaId: string;
  maxShifts: number;      // Global week max — drives column count
  onEstadoChange?: (liquidacionId: string, estado: 'APROBADO') => void;
}
```

### PlanillaDiaRow

```typescript
interface PlanillaDiaRowProps {
  dia: DiaLiquidacionData;
  maxShifts: number;
  isReadOnly: boolean;    // true when liquidacion.estado === 'APROBADO'
  onDiaUpdate: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}
```

### InlineHorasCell

```typescript
interface InlineHorasCellProps {
  diaId: string;
  currentHoras: number;
  isReadOnly: boolean;
  onSaved: (updatedDia: DiaLiquidacionData, updatedTotales: TotalesData) => void;
}
```
