# API Contracts: Tipo de Colaborador — Campo Fijo

All endpoints below are **amended** — they exist already; only the `fijo` field is added.

**Authentication**: All endpoints require a valid session cookie.

---

## GET /api/colaboradores

Returns the list of active collaborators. **Amended**: each item now includes `fijo`.

**Roles**: ADMINISTRADOR

### Response `200 OK` (amended)

```json
{
  "colaboradores": [
    {
      "id": "uuid",
      "nombre": "Ana",
      "apellido": "García",
      "cedula": "1234567",
      "activo": true,
      "tarifa_hora": 25.50,
      "fijo": false
    },
    {
      "id": "uuid",
      "nombre": "Luis",
      "apellido": "Pérez",
      "cedula": "7654321",
      "activo": true,
      "tarifa_hora": null,
      "fijo": true
    }
  ]
}
```

---

## POST /api/colaboradores

Create a new collaborator. **Amended**: accepts optional `fijo` field.

**Roles**: ADMINISTRADOR

### Request body (amended)

```json
{
  "nombre": "string (required)",
  "apellido": "string (required)",
  "cedula": "string (required)",
  "telefono": "string | null (optional)",
  "fecha_nacimiento": "YYYY-MM-DD | null (optional)",
  "supervisor_id": "uuid | null (optional)",
  "tarifa_hora": "number | null (optional)",
  "fijo": "boolean (optional, default: false)",
  "codigo_biometrico": {
    "dispositivo_id": "uuid",
    "workno": "string"
  }
}
```

---

## GET /api/colaboradores/[id]

Get a single collaborator profile. **Amended**: response includes `fijo`.

**Roles**: ADMINISTRADOR

### Response `200 OK` (amended, partial)

```json
{
  "id": "uuid",
  "nombre": "Luis",
  "apellido": "Pérez",
  "cedula": "7654321",
  "fijo": true,
  "activo": true,
  "tarifa_hora": null,
  "tipo_pago": null,
  "supervisor": null,
  "area": { "id": "uuid", "nombre": "Producción" },
  "plantilla_horario": null,
  "codigos_biometricos": []
}
```

---

## PATCH /api/colaboradores/[id]

Edit a collaborator. **Amended**: accepts `fijo` field.

**Roles**: ADMINISTRADOR only (unchanged — `checkAdminRole` already enforced)

### Request body (amended)

```json
{
  "nombre": "string (required)",
  "apellido": "string (required)",
  "cedula": "string (required)",
  "fijo": "boolean (optional)",
  "telefono": "string | null (optional)",
  "fecha_nacimiento": "YYYY-MM-DD | null (optional)",
  "supervisor_id": "uuid | null (optional)",
  "area_id": "uuid | null (optional)",
  "plantilla_horario_id": "uuid | null (optional)",
  "tipo_pago": "SEMANAL | QUINCENAL | MENSUAL | null (optional)",
  "codigos": [{ "id": "uuid", "workno": "string" }]
}
```

### Audit log entry

When `fijo` changes, `registros_auditoria` receives:
- `accion`: `'COLABORADOR_EDITADO'`
- `datos_anteriores`: includes `fijo: <previous value>`
- `datos_nuevos`: includes `fijo: <new value>`

---

## GET /api/planilla/[semanaId]

**No change to request/response contract.** Behavior change only: collaborators with `fijo = true` are silently excluded from the roster. The endpoint returns the same shape as before, with fewer collaborators when `fijo` ones exist.

---

## Error Responses (all endpoints, unchanged)

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "UNAUTHORIZED" }` | No or invalid session |
| 403 | `{ "error": "FORBIDDEN" }` | Insufficient role |
| 404 | `{ "error": "NOT_FOUND" }` | Collaborator not found |
| 409 | `{ "error": "DUPLICATE_CEDULA" }` | Cedula already exists |
| 422 | `{ "error": "VALIDATION_ERROR", "fields": {...} }` | Zod validation failure |
