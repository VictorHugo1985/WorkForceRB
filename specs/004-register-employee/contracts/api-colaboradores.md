# Contracts: API de Registro de Colaborador

**Feature**: 004-register-employee | **Date**: 2026-05-25
**Base URL**: `https://jornalero.vercel.app`
**Auth**: JWT HttpOnly cookie `access_token` (rol ADMINISTRADOR requerido)

---

## POST /api/colaboradores

Registra un nuevo colaborador. Crea el colaborador con campos obligatorios y opcionalmente configura tarifa, horario y código biométrico en la misma solicitud.

### Request

**Headers**:
```
Content-Type: application/json
Cookie: access_token=<jwt>
```

**Body**:
```json
{
  "nombre": "string (required)",
  "apellido": "string (required)",
  "cedula": "string (required)",
  "area_id": "uuid (required)",
  "supervisor_id": "uuid | null (optional)",
  "tarifa_hora": "number | null (optional — COP por hora)",
  "umbral_horas_extra": "number | null (optional — horas diarias)",
  "codigo_biometrico": {
    "dispositivo_id": "uuid",
    "workno": "string"
  } | null
}
```

**Validaciones**:
- `nombre`: non-empty string, max 100 chars
- `apellido`: non-empty string, max 100 chars
- `cedula`: non-empty string, UNIQUE — rechaza si ya existe (activo o inactivo)
- `area_id`: UUID válido de la tabla `areas`
- `supervisor_id`: UUID válido de `usuarios` con rol SUPERVISOR o ADMINISTRADOR (si se envía)
- `tarifa_hora`: número positivo en COP (si se envía)
- `umbral_horas_extra`: número positivo en horas (si se envía)
- `codigo_biometrico.workno`: string no vacío, UNIQUE por dispositivo_id

### Responses

**201 Created** — Colaborador creado (con o sin advertencias):
```json
{
  "colaborador": {
    "id": "uuid",
    "nombre": "string",
    "apellido": "string",
    "cedula": "string",
    "area_id": "uuid",
    "supervisor_id": "uuid | null",
    "activo": true,
    "creado_en": "ISO 8601"
  },
  "configuraciones_creadas": ["TARIFA_HORA", "UMBRAL_HORA_EXTRA"],
  "codigo_biometrico_creado": true,
  "warnings": []
}
```

**201 Created (con advertencias)** — Colaborador creado pero con fallos en opcionales:
```json
{
  "colaborador": { ... },
  "configuraciones_creadas": [],
  "codigo_biometrico_creado": false,
  "warnings": [
    "Código biométrico no asignado: workno '5327643' ya está activo en el dispositivo seleccionado."
  ]
}
```

**400 Bad Request** — Validación fallida en campos obligatorios:
```json
{ "error": "VALIDATION_ERROR", "fields": { "cedula": "Campo requerido", "area_id": "UUID inválido" } }
```

**401 Unauthorized** — Sin sesión activa:
```json
{ "error": "UNAUTHORIZED" }
```

**403 Forbidden** — Rol insuficiente:
```json
{ "error": "FORBIDDEN", "required_role": "ADMINISTRADOR" }
```

**409 Conflict** — Cédula duplicada:
```json
{ "error": "DUPLICATE_CEDULA", "message": "Ya existe un colaborador con la cédula ingresada." }
```

---

## GET /api/areas

Lista las áreas de trabajo activas para el dropdown del wizard.

### Request

**Headers**:
```
Cookie: access_token=<jwt>
```

### Response

**200 OK**:
```json
{
  "areas": [
    { "id": "uuid", "nombre": "Producción" },
    { "id": "uuid", "nombre": "Bodega" },
    { "id": "uuid", "nombre": "Administración" }
  ]
}
```

**401 Unauthorized**: `{ "error": "UNAUTHORIZED" }`

---

## GET /api/usuarios/supervisores

Lista usuarios disponibles para asignar como supervisor (ADMINISTRADOR o SUPERVISOR).

### Request

**Headers**:
```
Cookie: access_token=<jwt>
```

### Response

**200 OK**:
```json
{
  "supervisores": [
    { "id": "uuid", "nombre": "string", "apellido": "string", "rol_principal": "ADMINISTRADOR" }
  ]
}
```

**401 Unauthorized**: `{ "error": "UNAUTHORIZED" }`

---

## GET /api/colaboradores/[id]

Consulta el perfil completo de un colaborador (US3).

### Response

**200 OK**:
```json
{
  "id": "uuid",
  "nombre": "string",
  "apellido": "string",
  "cedula": "string",
  "area": { "id": "uuid", "nombre": "string" },
  "supervisor": { "id": "uuid", "nombre": "string", "apellido": "string" } | null,
  "activo": true,
  "creado_en": "ISO 8601",
  "tarifa_vigente": {
    "id": "uuid",
    "valor": 25000,
    "unidad": "COP",
    "vigente_desde": "2026-05-25"
  } | null,
  "horario_vigente": {
    "umbral_horas_extra": 8,
    "vigente_desde": "2026-05-25"
  } | null,
  "codigos_biometricos": [
    {
      "id": "uuid",
      "workno": "5327643",
      "dispositivo": { "id": "uuid", "nombre": "W1PRO", "numero_serie": "0680200024340009" },
      "activo": true
    }
  ]
}
```

**404 Not Found**: `{ "error": "NOT_FOUND" }`

**401 Unauthorized**: `{ "error": "UNAUTHORIZED" }`

---

## GET /api/dispositivos

Lista dispositivos biométricos activos para el dropdown del paso 5 del wizard.

### Response

**200 OK**:
```json
{
  "dispositivos": [
    { "id": "uuid", "nombre": "W1PRO", "numero_serie": "0680200024340009" }
  ]
}
```
