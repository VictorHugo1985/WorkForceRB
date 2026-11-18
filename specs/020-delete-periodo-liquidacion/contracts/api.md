# API Contracts: Eliminar Período de Liquidación

**One new endpoint.** All existing endpoints are unchanged.

**Authentication**: Valid session cookie required on all requests.

---

## DELETE /api/semanas-laborales/[id]

Delete a liquidation period and all its dependent BORRADOR records.

**Roles**: ADMINISTRADOR only

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | ID of the period to delete |

### Request body

None.

### Success response — `200 OK`

```json
{}
```

### Error responses

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "UNAUTHORIZED" }` | Missing or invalid session |
| 403 | `{ "error": "FORBIDDEN" }` | Caller is not ADMINISTRADOR |
| 404 | `{ "message": "Período no encontrado" }` | Period ID does not exist |
| 409 | `{ "message": "El período tiene liquidaciones aprobadas o pagadas y no puede eliminarse." }` | One or more `liquidacion_colaborador` rows have estado APROBADO or PAGADO |
| 422 | `{ "message": "Los períodos cerrados no pueden eliminarse." }` | Period estado is CERRADA |

### Behavior notes

- Deletion is atomic (single transaction). On failure, no partial deletes occur.
- On success, all `dias_liquidacion`, `liquidacion_colaborador` (BORRADOR), and `bonos` linked to this period are also deleted.
- A `registros_auditoria` entry with `accion = 'PERIODO_ELIMINADO'` is created on success.
- If the audit insert fails, the delete still completes (non-blocking, consistent with existing audit pattern in the codebase).
