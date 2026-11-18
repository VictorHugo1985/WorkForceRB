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

**Query**: `periodo` = `trimestre` \| `semestre` \| `anio` (default `trimestre`); `agrupacion` = `mes` \| `semana` (default `mes`).

**200**
```json
{
  "periodo": "trimestre",
  "agrupacion": "mes",
  "desde": "2026-09-01",
  "hasta": "2026-11-18",
  "primera_marcacion": "2026-06-08",
  "tramos": [
    { "key": "2026-09", "desde": "2026-09-01", "hasta": "2026-09-30", "etiqueta": "Sep 2026", "parcial": false, "sin_datos": false },
    { "key": "2026-10", "desde": "2026-10-01", "hasta": "2026-10-31", "etiqueta": "Oct 2026", "parcial": false, "sin_datos": false },
    { "key": "2026-11", "desde": "2026-11-01", "hasta": "2026-11-18", "etiqueta": "Nov 2026", "parcial": true,  "sin_datos": false }
  ],
  "areas": [ { "id": "uuid", "nombre": "Cocina" } ],
  "colaboradores": [
    {
      "id": "uuid", "nombre": "Juan", "apellido": "Pérez", "cedula": "1234567",
      "activo": true, "area_id": "uuid", "area_nombre": "Cocina",
      "celdas": [ { "horas": 182.5, "incompletos": 0 }, { "horas": 176.0, "incompletos": 2 }, { "horas": 98.25, "incompletos": 0 } ],
      "total_horas": 456.75,
      "total_incompletos": 2
    }
  ]
}
```

- `celdas[i]` corresponde a `tramos[i]`. En tramos `sin_datos`, `horas = 0` y el cliente muestra "sin datos".
- `horas` es un número con 2 decimales (el cliente lo muestra con 1).
- Incluye **todos** los colaboradores activos (aunque tengan 0 h) **y** los inactivos con horas > 0 en el período (se marcan `activo: false`); el filtro "Incluir inactivos" se aplica en el cliente.
- Orden por defecto: `apellido, nombre`.

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
