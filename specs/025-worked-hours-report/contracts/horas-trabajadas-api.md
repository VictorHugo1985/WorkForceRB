# API Contract: Reporte de Horas Trabajadas

**Feature**: 025-worked-hours-report | Route Handlers en `apps/web/src/app/api/horas-trabajadas`

Roles: **ADMINISTRADOR** o **SUPERVISOR** (`checkRoles`). Solo lectura.

| Status | Body | Cuándo |
|---|---|---|
| 401 | `{ "error": "UNAUTHORIZED" }` | Sin sesión válida |
| 403 | `{ "error": "FORBIDDEN", "required_roles": ["ADMINISTRADOR","SUPERVISOR"] }` | Rol insuficiente |
| 422 | `{ "error": "<mensaje>" }` | Parámetros inválidos |

---

## GET `/api/horas-trabajadas`

**Query**: `periodo` = `trimestre` \| `semestre` \| `anio` (default `trimestre`). Devuelve **ambas** agrupaciones en una sola respuesta (rediseño 2026-11-18).

**200**
```json
{
  "periodo": "trimestre",
  "desde": "2026-09-01",
  "hasta": "2026-11-18",
  "primera_marcacion": "2026-06-08",
  "tramos_mes":    [ { "key": "2026-09", "desde": "2026-09-01", "hasta": "2026-09-30", "etiqueta": "Sep 2026", "parcial": false, "sin_datos": false } ],
  "tramos_semana": [ { "key": "2026-W36", "desde": "2026-09-01", "hasta": "2026-09-06", "etiqueta": "01/09 – 06/09", "parcial": false, "sin_datos": false } ],
  "colaboradores": [
    {
      "id": "uuid", "nombre": "Juan", "apellido": "Pérez", "cedula": "1234567",
      "activo": true, "area_nombre": "Cocina",
      "mes":    [ { "horas": 182.5, "incompletos": 0 } ],
      "semana": [ { "horas": 41.25, "incompletos": 1 } ],
      "total_horas": 456.75,
      "total_incompletos": 2
    }
  ]
}
```

- `mes[i]` ↔ `tramos_mes[i]`; `semana[i]` ↔ `tramos_semana[i]`; Σ `mes` = Σ `semana` = `total_horas`.
- Incluye todos los activos e inactivos con marcaciones en el período. El **promedio** se calcula en el cliente sobre los activos con `total_horas > 0`.

---

## GET `/api/horas-trabajadas/detalle`

**Query**: `colaborador_id` (uuid), `desde`, `hasta` (YYYY-MM-DD; `desde ≤ hasta ≤ hoy`, ≤ 31 días).

**200**
```json
{
  "colaborador": { "id": "uuid", "nombre": "Juan", "apellido": "Pérez" },
  "desde": "2026-11-03",
  "hasta": "2026-11-09",
  "total_horas": 44.5,
  "dias": [
    {
      "fecha": "2026-11-03",
      "primera_entrada": "07:58",
      "ultima_salida": "17:02",
      "horas": 8.07,
      "incompleta": false,
      "pares": [ { "entrada": "07:58", "salida": "12:01", "horas": 4.05 }, { "entrada": "13:00", "salida": "17:02", "horas": 4.03 } ],
      "marcacion_suelta": null
    }
  ]
}
```

- Solo se listan los días con al menos una marcación.
- `marcacion_suelta` = hora `HH:MM` de la marcación sin pareja si `incompleta`.
- Σ `dias[].horas` = `total_horas` = valor de la celda correspondiente (SC-003).
- **404** `{ "error": "COLABORADOR_NOT_FOUND" }`.
