# Quickstart: Probar el Webhook CrossChex

**Feature**: 001-webhook-biometric-reception

---

## Escenario 1 — Evento válido con colaborador registrado

```bash
curl -X POST https://jornalero.vercel.app/api/webhooks/crosschex \
  -H "Content-Type: application/json" \
  -H "authorize-sign: TU_CROSSCHEX_WEBHOOK_SECRET" \
  -d '{
    "records": [{
      "uuid": "test-uuid-entrada-001",
      "device": {
        "serial_number": "0680200024340009",
        "name": "W1PRO"
      },
      "employee": {
        "workno": "5327643",
        "first_name": "Victor Hugo",
        "last_name": "Parada"
      },
      "check_time": "2026-05-25T14:00:00+00:00",
      "check_type": 0
    }]
  }'
```

**Respuesta esperada**: `{"code":"200","msg":"success"}`

**Verificar en BD**:
```sql
SELECT eb.estado_resolucion, ebd.checktime, ebd.tipo_evento
FROM eventos_biometricos eb
JOIN eventos_biometricos_desglosados ebd ON ebd.evento_id = eb.id
WHERE eb.request_id = 'test-uuid-entrada-001';
-- estado_resolucion: SIN_RESOLVER o RESUELTO según si workno 5327643 está en codigos_colaborador
-- checktime: 2026-05-25 10:00:00+00 (14:00 UTC − 4h = 10:00 GMT-4)
-- tipo_evento: ENTRADA
```

---

## Escenario 2 — Evento duplicado (idempotencia)

Reenviar el mismo payload del Escenario 1:
```bash
# Mismo UUID → debe responder 200 sin crear registro extra
curl -X POST https://jornalero.vercel.app/api/webhooks/crosschex \
  -H "Content-Type: application/json" \
  -H "authorize-sign: TU_CROSSCHEX_WEBHOOK_SECRET" \
  -d '{"records":[{"uuid":"test-uuid-entrada-001","device":{"serial_number":"0680200024340009","name":"W1PRO"},"employee":{"workno":"5327643"},"check_time":"2026-05-25T14:00:00+00:00","check_type":0}]}'
```

**Verificar**: COUNT en `eventos_biometricos` WHERE `request_id = 'test-uuid-entrada-001'` debe ser 1.

---

## Escenario 3 — Request sin autenticación (401)

```bash
curl -X POST https://jornalero.vercel.app/api/webhooks/crosschex \
  -H "Content-Type: application/json" \
  -d '{"records":[{"uuid":"test-no-auth"}]}'
```

**Respuesta esperada**: HTTP 401 `{"code":"401","msg":"unauthorized"}`

---

## Escenario 4 — Dispositivo desconocido

```bash
curl -X POST https://jornalero.vercel.app/api/webhooks/crosschex \
  -H "Content-Type: application/json" \
  -H "authorize-sign: TU_CROSSCHEX_WEBHOOK_SECRET" \
  -d '{"records":[{"uuid":"test-dispositivo-desconocido-001","device":{"serial_number":"SERIE-NO-REGISTRADA","name":"Otro Reloj"},"employee":{"workno":"9999"},"check_time":"2026-05-25T14:00:00+00:00","check_type":1}]}'
```

**Verificar**: `estado_resolucion = 'DISPOSITIVO_DESCONOCIDO'` en `eventos_biometricos`.

---

## Dispositivo registrado (W1PRO)

| Campo | Valor |
|---|---|
| Serial Number | `0680200024340009` |
| MAC | `38:BE:AB:15:FA:07` |
| Modelo | W1PRO |
| ID en BD | `6617cbbc-bac0-4abc-9815-197bd21ff38c` |

## Variables de entorno (Vercel)

Configurar en **Vercel → jornalero → Settings → Environment Variables**:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.vpzvpwqbiuztyqshkbvd:...@aws-1-us-east-1.pooler.supabase.com:5432/postgres` |
| `CROSSCHEX_WEBHOOK_SECRET` | Secreto configurado en CrossChex Cloud Developer Mode |

## Consulta de eventos recibidos

```sql
SELECT
  eb.request_id,
  eb.codigo_biometrico,
  eb.estado_resolucion,
  ebd.checktime,
  ebd.tipo_evento,
  ebd.device_name,
  ebd.employee_first_name || ' ' || ebd.employee_last_name AS empleado
FROM eventos_biometricos eb
LEFT JOIN eventos_biometricos_desglosados ebd ON ebd.evento_id = eb.id
ORDER BY eb.recibido_en DESC
LIMIT 20;
```
