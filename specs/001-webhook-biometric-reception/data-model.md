# Data Model: Recepción Webhook Biométrico

**Feature**: 001-webhook-biometric-reception
**Date**: 2026-05-25
**Schema Version**: v2.0 (Prisma schema en `apps/api/prisma/schema.prisma`)

---

## Entidades involucradas

### EventoBiometrico (`eventos_biometricos`)

Registro principal de cada marcaje recibido. **Append-only** — ningún UPDATE ni DELETE permitido en la capa de servicio.

| Campo | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID | NO | PK generado por la BD |
| `request_id` | TEXT | NO | UNIQUE — `records[].uuid` del payload CrossChex, clave de idempotencia |
| `dispositivo_id` | UUID | SÍ | FK → `dispositivos_biometricos.id`; NULL si dispositivo desconocido |
| `codigo_biometrico` | TEXT | NO | `employee.workno` tal como llega de CrossChex |
| `colaborador_id` | UUID | SÍ | FK → `colaboradores.id`; NULL si workno no asociado |
| `evento_referencia_id` | UUID | SÍ | FK self-ref para deduplicación (spec 011) |
| `estado_resolucion` | ENUM | NO | `RESUELTO` / `SIN_RESOLVER` / `DISPOSITIVO_DESCONOCIDO` |
| `payload_completo` | JSONB | NO | Payload original del `records[]` item, inmutable |
| `recibido_en` | TIMESTAMPTZ | NO | Timestamp de recepción por el sistema (UTC, generado por BD) |

**Constraint**: `UNIQUE (request_id)` — base de la idempotencia.
**Índices**: `(colaborador_id, recibido_en)`, `(estado_resolucion)`, `(evento_referencia_id)`.

---

### EventoBiometricoDesglosado (`eventos_biometricos_desglosados`)

Campos extraídos y normalizados del payload para consulta eficiente. Relación 1:1 con `eventos_biometricos`. **Append-only**.

| Campo | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | UUID | NO | PK generado por la BD |
| `evento_id` | UUID | NO | UNIQUE FK → `eventos_biometricos.id` |
| `checktime` | TIMESTAMPTZ | NO | Hora del marcaje en **hora local Venezuela (GMT-4)** |
| `checktype` | INTEGER | NO | Código numérico del método: 0=entrada, 1=salida |
| `tipo_evento` | ENUM | NO | `ENTRADA` / `SALIDA` / `DESCONOCIDO` — derivado de `check_type` |
| `device_serial_number` | TEXT | NO | `device.serial_number` del payload |
| `device_name` | TEXT | NO | `device.name` del payload |
| `employee_workno` | TEXT | NO | `employee.workno` del payload |
| `employee_first_name` | TEXT | SÍ | `employee.first_name` del payload |
| `employee_last_name` | TEXT | SÍ | `employee.last_name` del payload |
| `procesado_en` | TIMESTAMPTZ | NO | Timestamp de inserción del desglose (UTC, generado por BD) |

**Constraint**: `UNIQUE (evento_id)` — ON CONFLICT DO NOTHING previene duplicados.
**Índices**: `(checktime)`, `(employee_workno)`.

**Regla de timezone**: `checktime = UTC_recibido − 4h`. La BD almacena el valor como TIMESTAMPTZ pero representa la hora local venezolana.

---

### DispositivoBiometrico (`dispositivos_biometricos`) — lectura

Resuelve `dispositivo_id` por `numero_serie`. Solo lectura durante procesamiento del webhook.

| Campo relevante | Descripción |
|---|---|
| `id` | UUID usado como FK en `eventos_biometricos` |
| `numero_serie` | Clave de búsqueda (`device.serial_number` del payload) |
| `activo` | Solo se resuelve si `activo = true` |

---

### CodigoColaborador (`codigos_colaborador`) — lectura

Resuelve `colaborador_id` por `codigo_biometrico`. Solo lectura durante procesamiento del webhook.

| Campo relevante | Descripción |
|---|---|
| `colaborador_id` | UUID usado como FK en `eventos_biometricos` |
| `codigo_biometrico` | Clave de búsqueda (`employee.workno` del payload) |
| `activo` | Solo se resuelve si `activo = true` |

---

## Flujo de resolución de estado

```
payload.records[].uuid ─── UNIQUE check ──► ya existe → upsert no-op, retorna id
                                                │
                                                ▼ nuevo
                          device.serial_number ─► dispositivos_biometricos
                                                │
                               NULL ────────────┤ encontrado
                                │               ▼
                                │    employee.workno ─► codigos_colaborador
                                │               │
                                │        NULL ──┤  encontrado
                                │        │      ▼        ▼
                         DISPOSITIVO_  SIN_   RESUELTO
                         DESCONOCIDO  RESOLVER
```

---

## Enums relevantes

```sql
"EstadoResolucion": RESUELTO | SIN_RESOLVER | DISPOSITIVO_DESCONOCIDO | POTENCIAL_DUPLICADO | DUPLICADO
"TipoEvento":       ENTRADA  | SALIDA       | DESCONOCIDO
```
