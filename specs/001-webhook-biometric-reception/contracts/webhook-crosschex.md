# Contract: POST /api/webhooks/crosschex

**Endpoint**: `POST https://jornalero.vercel.app/api/webhooks/crosschex`
**Implementación**: `apps/web/src/app/api/webhooks/crosschex/route.ts`
**Protocolo**: HTTPS — JSON

---

## Request

### Headers requeridos

| Header | Valor esperado | Descripción |
|---|---|---|
| `Content-Type` | `application/json` | Body debe ser JSON válido |
| `authorize-sign` | `<CROSSCHEX_WEBHOOK_SECRET>` | Secreto compartido configurado en Vercel env var |

### Body (CrossChex Cloud format)

```json
{
  "records": [
    {
      "uuid": "<string>",
      "device": {
        "serial_number": "<string>",
        "name": "<string>"
      },
      "employee": {
        "workno": "<string>",
        "first_name": "<string | null>",
        "last_name": "<string | null>",
        "job_title": "<string | null>",
        "department": "<string | null>"
      },
      "check_time": "<ISO 8601 UTC>",
      "check_type": "<0 | 1>",
      "dst_check_time": "<ISO 8601 UTC>"
    }
  ]
}
```

**Campos obligatorios para resolución**: `records[].uuid`, `records[].device.serial_number`, `records[].employee.workno`, `records[].check_time`, `records[].check_type`.

**Campos opcionales** (se almacenan si presentes): `employee.first_name`, `employee.last_name`.

**`check_type`**: `0` = ENTRADA, `1` = SALIDA. Cualquier otro valor → `DESCONOCIDO`.

---

## Responses

### 200 OK — siempre ante firma válida

```json
{ "code": "200", "msg": "success" }
```

Devuelve 200 en todos los casos con firma válida: evento nuevo, duplicado, payload malformado, BD no disponible. CrossChex requiere este formato exacto para confirmar entrega.

### 401 Unauthorized — firma inválida o ausente

```json
{ "code": "401", "msg": "unauthorized" }
```

Devuelve 401 cuando el header `authorize-sign` no coincide con `CROSSCHEX_WEBHOOK_SECRET` o está ausente.

---

## Comportamiento de idempotencia

El campo `records[].uuid` se almacena como `request_id` en `eventos_biometricos` con constraint UNIQUE. Ante un reenvío (mismo uuid), la query es:

```sql
INSERT INTO eventos_biometricos (request_id, ...)
VALUES ($1, ...)
ON CONFLICT (request_id) DO UPDATE SET request_id = EXCLUDED.request_id
RETURNING id
```

El `RETURNING id` recupera el id existente → el desglose intenta insertar con `ON CONFLICT (evento_id) DO NOTHING` → responde 200 sin duplicar datos.

---

## Múltiples eventos por request

Un body puede contener más de un elemento en `records[]`. El sistema procesa cada uno de forma independiente con `Promise.allSettled` — el fallo de un evento no bloquea el procesamiento de los demás.

---

## Mapeo de campos payload → BD

| Campo payload | Campo BD | Tabla | Transformación |
|---|---|---|---|
| `records[].uuid` | `request_id` | `eventos_biometricos` | directo |
| `records[].device.serial_number` | lookup → `dispositivo_id` | `dispositivos_biometricos` | resolución por `numero_serie` |
| `records[].employee.workno` | `codigo_biometrico` | `eventos_biometricos` | directo |
| `records[].employee.workno` | lookup → `colaborador_id` | `codigos_colaborador` | resolución por `codigo_biometrico` |
| `records[].check_time` | `checktime` | `eventos_biometricos_desglosados` | UTC − 4h (GMT-4) |
| `records[].check_type` | `checktype` | `eventos_biometricos_desglosados` | directo |
| `records[].check_type` | `tipo_evento` | `eventos_biometricos_desglosados` | 0→ENTRADA, 1→SALIDA |
| `records[].device.serial_number` | `device_serial_number` | `eventos_biometricos_desglosados` | directo |
| `records[].device.name` | `device_name` | `eventos_biometricos_desglosados` | directo |
| `records[].employee.first_name` | `employee_first_name` | `eventos_biometricos_desglosados` | directo |
| `records[].employee.last_name` | `employee_last_name` | `eventos_biometricos_desglosados` | directo |
| body completo (`records[i]`) | `payload_completo` | `eventos_biometricos` | JSON.stringify del record |

---

## Variables de entorno requeridas

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string Supabase Session Pooler |
| `CROSSCHEX_WEBHOOK_SECRET` | Secreto compartido con CrossChex Cloud (configurado en Vercel) |

---

## Gaps conocidos (pendientes de implementación)

| FR | Descripción | Estado |
|---|---|---|
| FR-008 | Audit log en `registros_auditoria` ante acceso no autorizado | ⚠ No implementado — solo retorna 401 |
| FR-010 | Rotación del secreto sin interrupción | ⚠ Requiere cambio en Vercel env var + redeploy |
| Research D4 | Warning log si `check_time` fuera de rango (>24h pasado o futuro) | ⚠ No implementado |
