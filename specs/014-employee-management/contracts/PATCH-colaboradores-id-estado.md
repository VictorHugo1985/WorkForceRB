# Contract: PATCH /api/colaboradores/{id}/estado

**Feature**: 014-employee-management

## Purpose

Cambia el estado activo/inactivo de un colaborador (baja lógica o reactivación).
Registra la acción en `registros_auditoria`.

## Auth

- Required: JWT en cookie `access_token`
- Required role: `ADMINISTRADOR`
- Unauthorized → 401; Forbidden → 403

## Request

```
PATCH /api/colaboradores/{id}/estado
Content-Type: application/json
Cookie: access_token=<jwt>
```

```json
{
  "activo": false
}
```

| Field | Required | Validation |
|---|---|---|
| `activo` | Yes | boolean — `false` para dar de baja, `true` para reactivar |

## Response 200

```json
{
  "colaborador": {
    "id": "uuid",
    "activo": false
  }
}
```

## Response Codes

| Code | Condition |
|---|---|
| 200 | Estado actualizado correctamente |
| 400 | `INVALID_JSON` o `VALIDATION_ERROR` |
| 401 | Sin sesión válida |
| 403 | Rol insuficiente |
| 404 | Colaborador no encontrado |
| 500 | Error de DB |

## Behavior

- `activo: false` → colaborador dado de baja. Sus datos históricos (marcajes, liquidaciones) se conservan íntegramente.
- `activo: true` → colaborador reactivado. Vuelve a aparecer en la lista por defecto.
- No modifica `codigos_colaborador` — la resolución de eventos biométricos filtra por colaborador activo en el JOIN.

## Audit log

Registra en `registros_auditoria`:
- Si `activo = false`: `accion` = `COLABORADOR_BAJA`
- Si `activo = true`: `accion` = `COLABORADOR_REACTIVADO`
- `datos_anteriores`: `{ activo: <valor_previo> }`
- `datos_nuevos`: `{ activo: <valor_nuevo> }`
