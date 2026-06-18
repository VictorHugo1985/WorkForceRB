# Data Model: Eliminar Período de Liquidación

**No schema changes.** This feature adds a DELETE operation on existing tables without altering their structure.

---

## Tables Involved

### liquidacion_periodo (read + delete target)

The row being deleted. Relevant fields for eligibility checks:

| Column | Type | Deletion rule |
|--------|------|---------------|
| `id` | UUID | Identifies the row to delete |
| `estado` | ENUM (ABIERTA / CERRADA) | Must be `ABIERTA` to allow deletion |

### liquidacion_colaborador (cascade delete — BORRADOR only)

| Column | Relevance |
|--------|-----------|
| `semana_id` | FK to `liquidacion_periodo.id` |
| `estado` | Must have NO rows with `APROBADO` or `PAGADO`; BORRADOR rows are deleted |
| `id` | Used to find `dias_liquidacion` rows to cascade |

### dias_liquidacion (cascade delete)

Deleted because they reference `liquidacion_id` which is being deleted. No direct semana_id column — deleted transitively via `liquidacion_colaborador.id`.

### bonos (cascade delete)

| Column | Relevance |
|--------|-----------|
| `semana_id` | FK to the period; all bonos for this period are deleted |

### registros_auditoria (audit insert)

One row inserted on successful delete: `accion = 'PERIODO_ELIMINADO'`, `entidad_tipo = 'LiquidacionPeriodo'`, `entidad_id = <period_id>`, `datos_anteriores = { fecha_inicio, fecha_fin }`.

---

## Deletion Eligibility Logic

```
periodo.estado = 'ABIERTA'
AND COUNT(*) WHERE liquidacion_colaborador.semana_id = periodo.id
                AND liquidacion_colaborador.estado IN ('APROBADO', 'PAGADO') = 0
```

Both conditions must be true; any violation returns an error to the client.

---

## Delete Execution Order (within a single transaction)

1. Check existence → 404 if not found
2. Check eligibility → 409 if blocked
3. `DELETE FROM dias_liquidacion WHERE liquidacion_id IN (SELECT id FROM liquidacion_colaborador WHERE semana_id = $1)`
4. `DELETE FROM liquidacion_colaborador WHERE semana_id = $1`
5. `DELETE FROM bonos WHERE semana_id = $1`
6. `DELETE FROM liquidacion_periodo WHERE id = $1`
7. `INSERT INTO registros_auditoria (...)` (audit trail)

All steps 3–7 execute inside a single database transaction. If any step fails, the entire operation rolls back.
