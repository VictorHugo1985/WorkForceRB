# Contract: GET /api/colaboradores

**Feature**: 014-employee-management

## Purpose

Retorna la lista completa de colaboradores (activos e inactivos) para la vista de lista.
El filtrado por estado y búsqueda de texto se realizan client-side.

## Auth

- Required: JWT en cookie `access_token`
- Required role: `ADMINISTRADOR`
- Unauthorized → 401; Forbidden → 403

## Request

```
GET /api/colaboradores
Content-Type: application/json
Cookie: access_token=<jwt>
```

No query parameters — retorna todos.

## Response 200

```json
{
  "colaboradores": [
    {
      "id": "uuid",
      "nombre": "María",
      "apellido": "García",
      "cedula": "12345678",
      "activo": true,
      "area": {
        "id": "uuid",
        "nombre": "Producción"
      }
    }
  ]
}
```

## Response Codes

| Code | Condition |
|---|---|
| 200 | OK — array puede estar vacío `[]` |
| 401 | Sin sesión válida |
| 403 | Rol insuficiente |
| 500 | Error de DB |

## Notes

- Ordenado por `apellido ASC, nombre ASC`
- `area` puede ser `null` si el colaborador no tiene área asignada (no debería ocurrir dado que `area_id` es NOT NULL, pero el LEFT JOIN lo maneja)
- Sin paginación — todos los registros en una respuesta
