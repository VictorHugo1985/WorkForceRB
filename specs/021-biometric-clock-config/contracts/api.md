# API Contracts: Configuración de Relojes Biométricos

**Authentication**: Valid session cookie required on all requests.
**Authorization**: All endpoints require ADMINISTRADOR role.

---

## GET /api/dispositivos

List all biometric devices (active and inactive).

> **Breaking change from current implementation**: The existing GET returns only `{ dispositivos: [{ id, nombre, numero_serie }] }` for active devices. This endpoint will now return all devices with full fields (excluding `webhook_secreto`). Existing consumers (collaborator registration form) only use `id` and `nombre`, so they remain unaffected.

### Success response — `200 OK`

```json
{
  "dispositivos": [
    {
      "id": "uuid",
      "nombre": "Reloj Entrada Principal",
      "numero_serie": "ABC123",
      "tipo": "WEBHOOK",
      "activo": true,
      "tiene_webhook_secreto": true,
      "creado_en": "2026-06-18T10:00:00Z",
      "actualizado_en": "2026-06-18T10:00:00Z"
    }
  ]
}
```

### Error responses

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "UNAUTHORIZED" }` | Missing or invalid session |
| 403 | `{ "error": "FORBIDDEN" }` | Not ADMINISTRADOR |

---

## POST /api/dispositivos

Register a new biometric device.

### Request body

```json
{
  "nombre": "Reloj Comedor",
  "numero_serie": "XYZ789",
  "tipo": "WEBHOOK",
  "webhook_secreto": "s3cr3t"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `nombre` | string | ✅ | Max 100 chars |
| `numero_serie` | string | ❌ | Must be unique if provided |
| `tipo` | `"WEBHOOK"` \| `"CSV"` | ✅ | |
| `webhook_secreto` | string | If tipo=WEBHOOK | Ignored for CSV |

### Success response — `201 Created`

```json
{
  "id": "uuid",
  "nombre": "Reloj Comedor",
  "numero_serie": "XYZ789",
  "tipo": "WEBHOOK",
  "activo": true,
  "tiene_webhook_secreto": true,
  "creado_en": "2026-06-18T10:00:00Z",
  "actualizado_en": "2026-06-18T10:00:00Z"
}
```

### Error responses

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "message": "..." }` | Validation failure (missing nombre, invalid tipo) |
| 400 | `{ "message": "El secreto webhook es requerido para dispositivos de tipo WEBHOOK." }` | tipo=WEBHOOK + no secret |
| 401 | `{ "error": "UNAUTHORIZED" }` | Missing or invalid session |
| 403 | `{ "error": "FORBIDDEN" }` | Not ADMINISTRADOR |
| 409 | `{ "message": "Ya existe un dispositivo con ese número de serie." }` | Duplicate numero_serie |

---

## PATCH /api/dispositivos/[id]

Edit a device's data or toggle its active state.

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Device ID |

### Request body

All fields optional. Only provided fields are updated.

```json
{
  "nombre": "Reloj Entrada Actualizado",
  "numero_serie": "NEW123",
  "tipo": "CSV",
  "webhook_secreto": "nuevo_secreto",
  "activo": false
}
```

| Field | Type | Notes |
|-------|------|-------|
| `nombre` | string | Max 100 chars |
| `numero_serie` | string \| null | null clears the serial; unique check if provided |
| `tipo` | `"WEBHOOK"` \| `"CSV"` | Changing to CSV clears webhook_secreto |
| `webhook_secreto` | string | Only used when tipo=WEBHOOK; empty string is ignored (keeps existing) |
| `activo` | boolean | Toggle active state |

### Success response — `200 OK`

```json
{
  "id": "uuid",
  "nombre": "Reloj Entrada Actualizado",
  "numero_serie": "NEW123",
  "tipo": "CSV",
  "activo": false,
  "tiene_webhook_secreto": false,
  "actualizado_en": "2026-06-18T11:00:00Z"
}
```

### Error responses

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "message": "..." }` | Validation failure |
| 401 | `{ "error": "UNAUTHORIZED" }` | Missing or invalid session |
| 403 | `{ "error": "FORBIDDEN" }` | Not ADMINISTRADOR |
| 404 | `{ "message": "Dispositivo no encontrado" }` | ID does not exist |
| 409 | `{ "message": "Ya existe un dispositivo con ese número de serie." }` | Duplicate numero_serie |

### Behavior notes

- If `tipo` changes from WEBHOOK to CSV, `webhook_secreto` is cleared (set to NULL).
- If `webhook_secreto` is an empty string or omitted, the existing secret is kept unchanged.
- The audit log records `datos_anteriores` with the pre-edit state and `datos_nuevos` with the post-edit state (both excluding `webhook_secreto`). `activo` changes are logged separately with their own `accion`.
