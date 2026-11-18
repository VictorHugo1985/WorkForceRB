# Contract: PATCH /api/colaboradores/{id}

**Feature**: 014-employee-management

## Purpose

Actualiza los datos básicos editables de un colaborador: nombre, apellido, cédula, área y supervisor.
Registra la acción en `registros_auditoria`.

## Auth

- Required: JWT en cookie `access_token`
- Required role: `ADMINISTRADOR`
- Unauthorized → 401; Forbidden → 403

## Request

```
PATCH /api/colaboradores/{id}
Content-Type: application/json
Cookie: access_token=<jwt>
```

```json
{
  "nombre": "María",
  "apellido": "García López",
  "cedula": "12345678",
  "area_id": "uuid-area",
  "supervisor_id": "uuid-supervisor | null"
}
```

### Field rules

| Field | Required | Validation |
|---|---|---|
| `nombre` | Yes | string, min 1 char, max 100 |
| `apellido` | Yes | string, min 1 char, max 100 |
| `cedula` | Yes | string, min 1 char |
| `area_id` | Yes | UUID de área existente y activa |
| `supervisor_id` | No | UUID de usuario existente, o null |

## Response 200

```json
{
  "colaborador": {
    "id": "uuid",
    "nombre": "María",
    "apellido": "García López",
    "cedula": "12345678",
    "activo": true,
    "area_id": "uuid-area",
    "supervisor_id": "uuid-supervisor"
  }
}
```

## Response Codes

| Code | Condition |
|---|---|
| 200 | Actualizado correctamente |
| 400 | `INVALID_JSON` o `VALIDATION_ERROR` (campos inválidos) |
| 401 | Sin sesión válida |
| 403 | Rol insuficiente |
| 404 | Colaborador no encontrado |
| 409 | `DUPLICATE_CEDULA` — cédula ya usada por otro colaborador |
| 500 | Error de DB |

## Error body (400 VALIDATION_ERROR)

```json
{
  "error": "VALIDATION_ERROR",
  "fields": {
    "nombre": "Required",
    "cedula": "Required"
  }
}
```

## Error body (409)

```json
{
  "error": "DUPLICATE_CEDULA",
  "message": "Ya existe un colaborador con la cédula ingresada."
}
```

## Audit log

Registra en `registros_auditoria`:
- `accion`: `COLABORADOR_EDITADO`
- `datos_anteriores`: estado previo del colaborador
- `datos_nuevos`: nuevos valores aplicados
