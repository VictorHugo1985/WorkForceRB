# Data Model: Visualizador de Eventos Biométricos

**Feature**: 013-biometric-events-view | **Type**: Read-only queries — sin cambios de esquema

---

## Sin cambios al esquema de base de datos

Esta feature es de sólo lectura. No crea tablas, no añade columnas, no ejecuta migraciones.
Lee las tablas existentes definidas por spec 001 (webhook biométrico).

---

## Tablas consultadas (read-only)

### `eventos_biometricos`

Tabla principal. Cada fila es un evento biométrico recibido del webhook de CrossChex Cloud.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK del evento |
| `request_id` | TEXT | ID de deduplicación (UNIQUE) |
| `dispositivo_id` | UUID | FK a `dispositivos_biometricos` (nullable) |
| `codigo_biometrico` | TEXT | Workno del empleado (código en el reloj) |
| `colaborador_id` | UUID | FK a `colaboradores` — nulo si SIN_RESOLVER |
| `estado_resolucion` | EstadoResolucion | `RESUELTO` / `SIN_RESOLVER` / `DISPOSITIVO_DESCONOCIDO` |
| `payload_completo` | JSONB | Payload original del webhook |
| `creado_en` | TIMESTAMPTZ | Timestamp de inserción |

### `eventos_biometricos_desglosados`

Detalle del evento con campos normalizados del payload.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `evento_id` | UUID | FK a `eventos_biometricos` (1:1, UNIQUE) |
| `checktime` | TIMESTAMPTZ | Fecha/hora del marcaje (GMT-4 Venezuela) |
| `checktype` | INTEGER | Tipo numérico crudo del dispositivo |
| `tipo_evento` | TipoEvento | `ENTRADA` / `SALIDA` / `DESCONOCIDO` |
| `device_serial_number` | TEXT | Número de serie del dispositivo |
| `device_name` | TEXT | Nombre del dispositivo |
| `employee_workno` | TEXT | Código biométrico del empleado |
| `employee_first_name` | TEXT | Nombre capturado del empleado (nullable) |
| `employee_last_name` | TEXT | Apellido capturado del empleado (nullable) |

### `colaboradores`

Tabla de colaboradores del sistema. Referenciada para mostrar nombre y cédula cuando
el evento está RESUELTO.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `nombre` | TEXT | Nombre completo del colaborador |
| `cedula` | TEXT | Cédula de identidad |

### `dispositivos_biometricos`

Tabla de dispositivos registrados. Usada para poblar el desplegable de filtro por dispositivo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `nombre` | TEXT | Nombre del dispositivo |
| `numero_serie` | TEXT | Número de serie |
| `activo` | BOOLEAN | Si el dispositivo está activo |

---

## Query principal del endpoint

```sql
SELECT
  eb.id,
  eb.estado_resolucion,
  ebd.checktime,
  ebd.tipo_evento,
  ebd.device_name,
  ebd.employee_workno,
  CASE
    WHEN eb.colaborador_id IS NOT NULL THEN c.nombre
    ELSE TRIM(COALESCE(ebd.employee_first_name, '') || ' ' || COALESCE(ebd.employee_last_name, ''))
  END AS display_nombre,
  CASE
    WHEN eb.colaborador_id IS NOT NULL THEN c.cedula
    ELSE ebd.employee_workno
  END AS display_identificador
FROM eventos_biometricos eb
LEFT JOIN eventos_biometricos_desglosados ebd ON eb.id = ebd.evento_id
LEFT JOIN colaboradores c ON eb.colaborador_id = c.id
WHERE ebd.checktime >= $1                  -- fecha_desde
  AND ebd.checktime < $2                   -- fecha_hasta
  AND ($3::text IS NULL OR
       c.nombre ILIKE '%' || $3 || '%' OR
       c.cedula ILIKE '%' || $3 || '%' OR
       ebd.employee_workno ILIKE '%' || $3 || '%')
  AND ($4::text IS NULL OR ebd.tipo_evento::text = $4)
  AND ($5::text IS NULL OR ebd.device_name = $5)
  AND ($6::text IS NULL OR eb.estado_resolucion::text = $6)
ORDER BY ebd.checktime DESC
LIMIT $7 OFFSET $8
```

## Query de conteo (para paginación)

```sql
SELECT COUNT(*)
FROM eventos_biometricos eb
LEFT JOIN eventos_biometricos_desglosados ebd ON eb.id = ebd.evento_id
LEFT JOIN colaboradores c ON eb.colaborador_id = c.id
WHERE -- mismos filtros que la query principal
```

---

## Enums relevantes

```
TipoEvento:       ENTRADA | SALIDA | DESCONOCIDO
EstadoResolucion: RESUELTO | SIN_RESOLVER | DISPOSITIVO_DESCONOCIDO
```
