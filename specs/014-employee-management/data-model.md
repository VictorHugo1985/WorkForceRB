# Data Model: Gestión Completa de Colaboradores

**Feature**: 014-employee-management | **Date**: 2026-05-26

> No se realizan cambios al esquema de base de datos. Este feature opera íntegramente
> sobre tablas existentes. El diagrama documenta las tablas relevantes y sus relaciones
> para contextualizar los endpoints que se implementarán.

---

## Tablas involucradas

### `colaboradores`

| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | UUID | PK, NOT NULL | `gen_random_uuid()` |
| `nombre` | VARCHAR | NOT NULL | Min 1 char |
| `apellido` | VARCHAR | NOT NULL | Min 1 char |
| `cedula` | VARCHAR | NOT NULL, UNIQUE | Identidad única |
| `activo` | BOOLEAN | NOT NULL, DEFAULT true | Baja lógica |
| `area_id` | UUID | NOT NULL, FK → `areas.id` | Área de trabajo |
| `supervisor_id` | UUID | NULLABLE, FK → `usuarios.id` | Supervisor asignado |
| `creado_en` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Timestamp de registro |
| `actualizado_en` | TIMESTAMPTZ | NOT NULL | Actualizado en app layer |

**State transitions**:
```
activo=true ──[Dar de baja]──► activo=false
activo=false ──[Reactivar]──► activo=true
```

**Validation rules**:
- `cedula` MUST be unique across all rows (not just activos)
- `area_id` MUST reference an existing area with `activo=true`
- `nombre` and `apellido` MUST be non-empty strings

---

### `areas`

| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | UUID | PK, NOT NULL | |
| `nombre` | VARCHAR | NOT NULL | |
| `activo` | BOOLEAN | NOT NULL, DEFAULT true | Solo áreas activas se ofrecen en selects |

---

### `codigos_colaborador`

| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | UUID | PK, NOT NULL | |
| `colaborador_id` | UUID | NOT NULL, FK → `colaboradores.id` | |
| `dispositivo_id` | UUID | NOT NULL, FK → `dispositivos_biometricos.id` | |
| `codigo_biometrico` | VARCHAR | NOT NULL | workno en el dispositivo |
| `activo` | BOOLEAN | NOT NULL, DEFAULT true | |

> La baja de un colaborador NO cambia `codigos_colaborador.activo`. La resolución de eventos
> biométricos filtra colaboradores activos en el JOIN — colaboradores inactivos quedan sin resolver.

---

### `registros_auditoria` (lectura/escritura)

| Columna | Tipo | Notas |
|---|---|---|
| `accion` | VARCHAR | Ej: `COLABORADOR_EDITADO`, `COLABORADOR_BAJA`, `COLABORADOR_REACTIVADO` |
| `entidad_tipo` | VARCHAR | `'Colaborador'` |
| `entidad_id` | UUID | ID del colaborador afectado |
| `usuario_id` | UUID | ID del admin que ejecutó la acción |
| `descripcion` | TEXT | Descripción legible |
| `datos_anteriores` | JSONB | Estado previo (para edición y baja) |
| `datos_nuevos` | JSONB | Estado nuevo |
| `ip_origen` | VARCHAR | IP del request |

---

## Consultas SQL clave

### Lista completa (GET /api/colaboradores)

```sql
SELECT c.id, c.nombre, c.apellido, c.cedula, c.activo,
       a.id AS area_id, a.nombre AS area_nombre
FROM colaboradores c
LEFT JOIN areas a ON a.id = c.area_id
ORDER BY c.apellido, c.nombre
```

### Edición básica (PATCH /api/colaboradores/{id})

```sql
-- Verificar unicidad de cédula excluyendo al colaborador actual
SELECT id FROM colaboradores WHERE cedula = $1 AND id != $2 LIMIT 1

-- Actualizar campos editables
UPDATE colaboradores
SET nombre = $1, apellido = $2, cedula = $3,
    area_id = $4, supervisor_id = $5, actualizado_en = now()
WHERE id = $6
```

### Baja lógica (PATCH /api/colaboradores/{id}/estado)

```sql
UPDATE colaboradores SET activo = $1, actualizado_en = now() WHERE id = $2
```
