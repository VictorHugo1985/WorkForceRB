# Data Model: Configuración de Relojes Biométricos

**No schema changes.** All required fields already exist in `dispositivos_biometricos`.

---

## Table: `dispositivos_biometricos` (existing — read + write)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto | Identifier |
| `nombre` | TEXT | NOT NULL | Descriptive name (e.g., "Reloj Entrada Principal") |
| `numero_serie` | TEXT | UNIQUE, nullable | Hardware serial number; nullable for CSV-only devices |
| `tipo` | ENUM | NOT NULL | `WEBHOOK` (real-time HTTP) or `CSV` (manual import) |
| `activo` | BOOLEAN | NOT NULL, default true | Active/inactive state |
| `webhook_secreto` | TEXT | nullable | Authentication secret for WEBHOOK devices; never returned in API responses |
| `creado_en` | TIMESTAMPTZ | auto | Creation timestamp |
| `actualizado_en` | TIMESTAMPTZ | auto (updatedAt) | Last update timestamp |

### Validation rules

- `nombre`: required, max 100 characters
- `numero_serie`: optional; if provided, must be unique across ALL devices (active and inactive)
- `tipo`: must be one of `WEBHOOK` or `CSV`
- `webhook_secreto`: required when `tipo = WEBHOOK`; ignored/cleared when `tipo = CSV`

### State transitions

```
ACTIVO ──[inactivar]──► INACTIVO
INACTIVO ──[activar]──► ACTIVO
```

No terminal state. Devices can be toggled freely. No deletion allowed.

---

## Table: `registros_auditoria` (audit insert on each write)

One row per operation with these values:

| Operation | `accion` | `entidad_tipo` |
|-----------|----------|----------------|
| Create | `RELOJ_REGISTRADO` | `DispositivoBiometrico` |
| Edit | `RELOJ_MODIFICADO` | `DispositivoBiometrico` |
| Inactivate | `RELOJ_INACTIVADO` | `DispositivoBiometrico` |
| Reactivate | `RELOJ_ACTIVADO` | `DispositivoBiometrico` |

Common fields: `entidad_id = <device_id>`, `usuario_id = auth.userId`, `datos_anteriores = <prev state>`, `datos_nuevos = <new state>` (excluding `webhook_secreto`).

---

## API Response Shape

The `webhook_secreto` field is **never returned** in any API response. Instead, responses include:

```json
{
  "id": "uuid",
  "nombre": "Reloj Entrada Principal",
  "numero_serie": "ABC123",
  "tipo": "WEBHOOK",
  "activo": true,
  "tiene_webhook_secreto": true,
  "creado_en": "2026-06-18T...",
  "actualizado_en": "2026-06-18T..."
}
```

---

## Relationships (unchanged)

```
dispositivos_biometricos
  ├── codigos_colaborador (FK: dispositivo_id) — collaborator device codes
  └── eventos_biometricos (FK: dispositivo_id) — biometric events
```

Deleting a device is blocked by these FK relationships — soft deletion (inactivation) is the only allowed operation, consistent with FR-007.
