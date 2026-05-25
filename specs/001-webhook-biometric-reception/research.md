# Research: Recepción Webhook Biométrico CrossChex Cloud

**Feature**: 001-webhook-biometric-reception
**Date**: 2026-05-25
**Status**: COMPLETO — validado con webhook real recibido el 2026-05-25

---

## Decisión 1: Estructura real del payload CrossChex Cloud

**Decision**: CrossChex Cloud envuelve los eventos en un array `records[]` dentro del body JSON. Cada elemento del array es un evento de marcaje independiente con su propio `uuid`.

```json
{
  "records": [
    {
      "uuid": "c67abeff189b6f53edd152ee4305ecc7be9975187cab0cecc71716bc7ea80709",
      "device": {
        "name": "W1PRO",
        "serial_number": "0680200024340009"
      },
      "employee": {
        "workno": "5327643",
        "first_name": "Victor Hugo",
        "last_name": "Parada",
        "job_title": "ERP",
        "department": "Rosa Betania"
      },
      "check_time": "2026-05-25T22:24:48+00:00",
      "check_type": 0,
      "dst_check_time": "2026-05-25T22:24:48+00:00"
    }
  ]
}
```

**Rationale**: Validado con la primera llamada real de CrossChex Cloud el 2026-05-25. La spec original asumía campos en el nivel raíz del body (`body.checktime`, `body.device`, etc.) — incorrecto.

**Alternatives considered**: Spec original asumía formato flat. Descartado por evidencia real.

---

## Decisión 2: Campo de idempotencia — `records[].uuid`

**Decision**: El campo `uuid` dentro de cada elemento de `records[]` es el identificador único por evento y se usa como clave de idempotencia (`request_id` en la tabla `eventos_biometricos`).

**Rationale**: CrossChex Cloud no envía un header `requestid` de forma consistente. El `uuid` del payload es un hash SHA-256 del contenido del evento — suficientemente único y reproducible para idempotencia.

**Alternatives considered**:
- Header HTTP `requestid`: no llega en los webhooks reales de CrossChex Cloud.
- UUID generado por el servidor: no idempotente ante reintentos de CrossChex.

---

## Decisión 3: `check_type` como indicador de dirección

**Decision**: `check_type = 0` → ENTRADA, `check_type = 1` → SALIDA.

**Rationale**: Confirmado por el fabricante y validado con el primer webhook real (check_type=0 para marcaje de entrada).

**Alternatives considered**: `direction`, `type`, `checkInOut` — campos de formato alternativo no presentes en CrossChex Cloud.

---

## Decisión 4: Zona horaria — GMT-4 (Venezuela)

**Decision**: `check_time` llega en UTC desde CrossChex Cloud. El sistema resta 4 horas antes de persistir en `checktime` de `eventos_biometricos_desglosados`, almacenando la hora local venezolana.

**Rationale**: La empresa opera exclusivamente en Venezuela (GMT-4 / America/Caracas). Todos los usuarios del sistema están en esa zona horaria. Almacenar hora local evita conversiones en cada consulta y hace los datos legibles directamente en la BD sin configuración de timezone en el cliente.

**Alternatives considered**:
- UTC con conversión en queries: correcto técnicamente pero requiere SET timezone en cada cliente.
- UTC con offset -04:00 en TIMESTAMPTZ: equivalente al almacenamiento UTC, no resuelve la visualización.

---

## Decisión 5: Plataforma de deploy — Next.js API Route (no NestJS)

**Decision**: El webhook se implementa como Next.js API Route (`apps/web/src/app/api/webhooks/crosschex/route.ts`) desplegado en Vercel, usando `pg` directamente sin Prisma.

**Rationale**: Solo `apps/web` está desplegado en Vercel. El NestJS API (`apps/api`) no tiene deploy público disponible para el MVP. Next.js API Routes en Vercel son serverless — sin estado persistente en memoria entre invocaciones.

**Alternatives considered**:
- NestJS webhook (ya implementado en `apps/api/src/webhooks/`): requiere deploy separado de NestJS — descartado por complejidad operacional del MVP.
- Prisma en web app: conflictos de versión con el Prisma del workspace raíz — descartado, se usa `pg` directamente.

---

## Decisión 6: Comportamiento ante fallo de BD

**Decision**: Si la BD no está disponible, el sistema responde HTTP 200 a CrossChex y registra el error en el log de aplicación. El evento se pierde.

**Rationale**: CrossChex reintenta solo ante respuestas no-2xx. Un ciclo de reintentos mientras la BD está caída empeoraría la situación. La pérdida ocasional de un evento es aceptable para el MVP.

**Alternatives considered**:
- Buffer temporal en memoria: no viable en serverless (cada invocación es nueva instancia).
- HTTP 503 para forzar reintento: los reintentos de CrossChex son limitados (2 en 1 minuto) — no garantizan recuperación.

---

## Decisión 7: Resolución de dispositivo y colaborador

**Decision**: En cada webhook, el sistema resuelve `dispositivo_id` buscando por `numero_serie` en `dispositivos_biometricos` y `colaborador_id` buscando por `codigo_biometrico` en `codigos_colaborador`. El estado de resolución es:
- `RESUELTO`: dispositivo Y colaborador encontrados
- `SIN_RESOLVER`: dispositivo encontrado, colaborador no
- `DISPOSITIVO_DESCONOCIDO`: dispositivo no encontrado

**Rationale**: Permite preservar 100% de los eventos incluso sin registro previo del colaborador o del dispositivo, alineado con Principio III y FR-007/FR-011.

**Alternatives considered**: Rechazar eventos de dispositivos desconocidos — viola el principio de inmutabilidad y FR-011.
