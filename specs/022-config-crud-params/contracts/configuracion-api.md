# API Contract: Configuración — Parámetros

**Feature**: 022-config-crud-params | **Date**: 2026-06-18

All routes require `Authorization: Bearer <token>` with role `ADMINISTRADOR`. Non-admin requests return `401 Unauthorized`. All request/response bodies are `application/json`.

Error response shape (all errors):
```json
{ "error": "string" }
```

---

## Áreas

### `GET /api/configuracion/areas`

Returns all areas (active + inactive), ordered by nombre.

**Response 200**:
```json
{
  "areas": [
    { "id": "uuid", "nombre": "string", "activo": true, "creado_en": "ISO8601" }
  ]
}
```

---

### `POST /api/configuracion/areas`

Creates a new area.

**Request body**:
```json
{ "nombre": "string" }
```

**Validations**:
- `nombre`: required, non-empty after trim, max 100 chars

**Responses**:
- `201` — Created:
  ```json
  { "area": { "id": "uuid", "nombre": "string", "activo": true, "creado_en": "ISO8601" } }
  ```
- `409` — Nombre already exists: `{ "error": "Ya existe un área con ese nombre." }`
- `422` — Validation error: `{ "error": "El nombre es obligatorio." }`

---

### `PATCH /api/configuracion/areas/[id]`

Updates nombre and/or activo for an area.

**Request body** (all fields optional, at least one required):
```json
{ "nombre": "string", "activo": true }
```

**Validations**:
- `nombre`: non-empty after trim, max 100 chars (if present)
- `activo`: boolean (if present)

**Responses**:
- `200` — Updated:
  ```json
  { "area": { "id": "uuid", "nombre": "string", "activo": true, "creado_en": "ISO8601" } }
  ```
- `404` — Not found: `{ "error": "Área no encontrada." }`
- `409` — Nombre conflict: `{ "error": "Ya existe un área con ese nombre." }`
- `422` — Last active guard: `{ "error": "Debe existir al menos un área activa." }`

---

### `DELETE /api/configuracion/areas/[id]`

Permanently deletes an area.

**Responses**:
- `204` — Deleted (no body)
- `404` — Not found: `{ "error": "Área no encontrada." }`
- `422` — Has collaborators: `{ "error": "No se puede eliminar el área porque tiene colaboradores asignados. Puedes inactivarla en su lugar." }`

---

## Tipos de Ajuste

### `GET /api/configuracion/tipos-ajuste`

Returns all tipos de ajuste (active + inactive), ordered by nombre.

**Response 200**:
```json
{
  "tiposAjuste": [
    { "id": "uuid", "nombre": "string", "activo": true, "creado_en": "ISO8601" }
  ]
}
```

---

### `POST /api/configuracion/tipos-ajuste`

Creates a new tipo de ajuste.

**Request body**:
```json
{ "nombre": "string" }
```

**Validations**:
- `nombre`: required, non-empty after trim, max 100 chars

**Responses**:
- `201` — Created:
  ```json
  { "tipoAjuste": { "id": "uuid", "nombre": "string", "activo": true, "creado_en": "ISO8601" } }
  ```
- `409` — Nombre conflict: `{ "error": "Ya existe un tipo de ajuste con ese nombre." }`
- `422` — Validation: `{ "error": "El nombre es obligatorio." }`

---

### `PATCH /api/configuracion/tipos-ajuste/[id]`

Updates nombre and/or activo.

**Request body** (all optional, at least one required):
```json
{ "nombre": "string", "activo": true }
```

**Responses**:
- `200` — Updated:
  ```json
  { "tipoAjuste": { "id": "uuid", "nombre": "string", "activo": true, "creado_en": "ISO8601" } }
  ```
- `404` — Not found
- `409` — Nombre conflict
- `422` — Last active guard: `{ "error": "Debe existir al menos un tipo de ajuste activo." }`

---

### `DELETE /api/configuracion/tipos-ajuste/[id]`

Permanently deletes a tipo de ajuste.

**Responses**:
- `204` — Deleted
- `404` — Not found
- `422` — In use: `{ "error": "No se puede eliminar porque está siendo usado en registros de liquidación." }`

---

## Tipos de Período de Pago

### `GET /api/configuracion/tipos-periodo-pago`

Returns all tipos de período de pago, ordered by codigo.

**Response 200**:
```json
{
  "tiposPeriodoPago": [
    { "codigo": "SEMANAL", "nombre": "Semanal", "activo": true }
  ]
}
```

---

### `PATCH /api/configuracion/tipos-periodo-pago/[codigo]`

Updates `activo` only (no rename, no create, no delete).

**Request body**:
```json
{ "activo": true }
```

**Responses**:
- `200` — Updated:
  ```json
  { "tipoPeriodoPago": { "codigo": "SEMANAL", "nombre": "Semanal", "activo": true } }
  ```
- `404` — Not found: `{ "error": "Tipo de período de pago no encontrado." }`
- `422` — Last active guard: `{ "error": "Debe existir al menos un tipo de período de pago activo." }`
