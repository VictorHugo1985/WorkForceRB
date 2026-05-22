# API Contracts: Control de Eventos Biométricos Duplicados

**Feature**: 011-attendance-dedup | **Date**: 2026-05-22
**Base**: NestJS `apps/api` | **Auth**: JWT HttpOnly cookie

---

## Roles autorizados

Las acciones de descarte y confirmación están disponibles para:
- `ADMINISTRADOR` — acceso total
- `SUPERVISOR` — solo colaboradores de su equipo
- `CAJERO` — puede descartar/confirmar (acceso explícito por spec 011 FR-008)

El rol `COLABORADOR` no tiene acceso a estas acciones.

---

## Endpoint 1 — Descartar evento potencial duplicado

```
PATCH /biometric-events/:id/discard
Authorization: JWT HttpOnly cookie (roles: ADMINISTRADOR | SUPERVISOR | CAJERO)
```

**Request body**:
```json
{
  "justificacion": "string (requerido, 5–500 chars)"
}
```

**Responses**:

| Status | Descripción |
|--------|-------------|
| `200 OK` | Evento descartado correctamente. Retorna el evento actualizado. |
| `400 Bad Request` | Justificación vacía o demasiado corta. |
| `403 Forbidden` | El usuario no tiene rol autorizado, o el colaborador no es de su equipo (SUPERVISOR). |
| `404 Not Found` | Evento no existe. |
| `409 Conflict` | El evento no está en estado `POTENCIAL_DUPLICADO`. |

**Response body (200)**:
```json
{
  "id": "uuid",
  "estado_resolucion": "DUPLICADO",
  "evento_referencia_id": "uuid",
  "descartado_por": {
    "id": "uuid",
    "nombre": "string"
  },
  "descartado_en": "ISO 8601 timestamp"
}
```

**Efectos secundarios**:
1. `estado_resolucion` → `DUPLICADO`
2. Registro en `registros_auditoria`: `accion = 'DESCARTE_DUPLICADO'`, `datos_anteriores = { estado: 'POTENCIAL_DUPLICADO' }`, `datos_nuevos = { estado: 'DUPLICADO', justificacion }`
3. Recálculo de horas del día afectado para el colaborador → actualizando su `LiquidacionSemanal` BORRADOR si existe

---

## Endpoint 2 — Confirmar evento como válido (falso positivo)

```
PATCH /biometric-events/:id/confirm-valid
Authorization: JWT HttpOnly cookie (roles: ADMINISTRADOR | SUPERVISOR | CAJERO)
```

**Request body**:
```json
{
  "justificacion": "string (requerido, 5–500 chars)"
}
```

**Responses**:

| Status | Descripción |
|--------|-------------|
| `200 OK` | Evento confirmado como válido. Retorna el evento actualizado. |
| `400 Bad Request` | Justificación vacía o demasiado corta. |
| `403 Forbidden` | Sin autorización o colaborador fuera del equipo. |
| `404 Not Found` | Evento no existe. |
| `409 Conflict` | El evento no está en estado `POTENCIAL_DUPLICADO`. |

**Response body (200)**:
```json
{
  "id": "uuid",
  "estado_resolucion": "RESUELTO",
  "evento_referencia_id": null,
  "confirmado_por": {
    "id": "uuid",
    "nombre": "string"
  },
  "confirmado_en": "ISO 8601 timestamp"
}
```

**Efectos secundarios**:
1. `estado_resolucion` → `RESUELTO`
2. `evento_referencia_id` → `null` (la marca de duplicado se elimina)
3. Registro en `registros_auditoria`: `accion = 'CONFIRMACION_VALIDO_DUPLICADO'`
4. No requiere recálculo (el evento ya estaba incluido en cálculos)

---

## Endpoint 3 — Listar eventos biométricos con filtro de estado

```
GET /biometric-events
Authorization: JWT HttpOnly cookie (roles: ADMINISTRADOR | SUPERVISOR | CAJERO)
Query params:
  colaborador_id  UUID     requerido
  fecha_desde     DATE     requerido (YYYY-MM-DD)
  fecha_hasta     DATE     requerido (YYYY-MM-DD)
  estado          string   opcional — RESUELTO | POTENCIAL_DUPLICADO | DUPLICADO | SIN_RESOLVER | DISPOSITIVO_DESCONOCIDO
  page            int      opcional, default 1
  page_size       int      opcional, default 50, max 200
```

**Responses**:

| Status | Descripción |
|--------|-------------|
| `200 OK` | Lista paginada de eventos. |
| `403 Forbidden` | Colaborador no pertenece al equipo del supervisor. |
| `422 Unprocessable Entity` | Parámetros de fecha inválidos o rango > 31 días. |

**Response body (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "checktime": "ISO 8601 timestamp",
      "tipo_evento": "ENTRADA | SALIDA | DESCONOCIDO",
      "estado_resolucion": "RESUELTO | POTENCIAL_DUPLICADO | DUPLICADO | ...",
      "dispositivo": { "id": "uuid", "nombre": "string" },
      "evento_referencia": {
        "id": "uuid",
        "checktime": "ISO 8601 timestamp"
      }
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 50
}
```

**Nota**: El campo `evento_referencia` solo está presente cuando `estado_resolucion = POTENCIAL_DUPLICADO | DUPLICADO`.

---

## Lógica de autorización por rol

```typescript
// Guard de scope de equipo (SUPERVISOR)
// El ADMINISTRADOR y CAJERO tienen acceso global
// El SUPERVISOR solo puede operar sobre colaboradores en su equipo asignado

async function canActOnCollaborator(
  userId: string,
  colaboradorId: string,
  userRoles: RolUsuario[]
): Promise<boolean> {
  if (userRoles.includes(RolUsuario.ADMINISTRADOR)) return true;
  if (userRoles.includes(RolUsuario.CAJERO)) return true;
  if (userRoles.includes(RolUsuario.SUPERVISOR)) {
    // Verificar que el colaborador tiene supervisor_id = userId
    const colaborador = await colaboradoresRepo.findOne(colaboradorId);
    return colaborador?.supervisor_id === userId;
  }
  return false;
}
```

---

## DTOs (NestJS / class-validator)

```typescript
// discard-event.dto.ts / confirm-event.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';

export class EventActionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  justificacion: string;
}
```

---

## Registro de Auditoría — Acciones definidas

| Acción (`accion`) | Descripción |
|-------------------|-------------|
| `DESCARTE_DUPLICADO` | Evento pasó de `POTENCIAL_DUPLICADO` a `DUPLICADO` |
| `CONFIRMACION_VALIDO_DUPLICADO` | Evento pasó de `POTENCIAL_DUPLICADO` a `RESUELTO` |

Ambas acciones registran: `usuario_id`, `entidad_tipo = 'EventoBiometrico'`, `entidad_id`, `justificacion` en `descripcion`, `datos_anteriores.estado`, `datos_nuevos.estado`.

---

## Endpoint interno — Detección de duplicado (no expuesto)

El `DeduplicationService` es un servicio interno llamado desde el pipeline de procesamiento de spec 001. No expone endpoint REST. Su método principal:

```typescript
// deduplication.service.ts
async checkAndMark(eventId: string): Promise<void>
// Pasos:
// 1. Leer evento + desglose (tipo_evento + checktime + colaborador_id)
// 2. Leer DEDUP_WINDOW_MINUTES de ConfiguracionRegla (caché 60s)
// 3. Consultar último evento RESUELTO del mismo colaborador + tipo_evento dentro de la ventana
// 4. Si encontrado → UPDATE estado_resolucion=POTENCIAL_DUPLICADO, evento_referencia_id=id_encontrado
// 5. Si no encontrado → no hacer nada (evento permanece RESUELTO)
```
