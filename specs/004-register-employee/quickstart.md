# Quickstart: Probar el Registro de Colaborador

**Feature**: 004-register-employee
**Base URL**: `https://jornalero.vercel.app`

---

## Pre-requisito: obtener token de sesión

```bash
TOKEN=$(curl -s -c /tmp/cookies.txt -X POST https://jornalero.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"victor.hpp@gmail.com","password":"123456"}' | jq -r '.user.id')
# La cookie access_token queda en /tmp/cookies.txt
```

---

## Escenario 1 — Registro completo (US1: happy path)

```bash
curl -s -b /tmp/cookies.txt -X POST https://jornalero.vercel.app/api/colaboradores \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan",
    "apellido": "Pérez",
    "cedula": "12345678",
    "area_id": "<UUID del área Producción>",
    "supervisor_id": null,
    "tarifa_hora": 25000,
    "umbral_horas_extra": 8,
    "codigo_biometrico": {
      "dispositivo_id": "6617cbbc-bac0-4abc-9815-197bd21ff38c",
      "workno": "9991234"
    }
  }'
```

**Respuesta esperada** (HTTP 201):
```json
{
  "colaborador": { "id": "...", "nombre": "Juan", "apellido": "Pérez", ... },
  "configuraciones_creadas": ["TARIFA_HORA", "UMBRAL_HORA_EXTRA"],
  "codigo_biometrico_creado": true,
  "warnings": []
}
```

**Verificar en BD**:
```sql
-- Colaborador creado y activo
SELECT id, nombre, apellido, cedula, area_id, activo
FROM colaboradores WHERE cedula = '12345678';

-- Código biométrico vinculado
SELECT cc.codigo_biometrico, db.nombre as dispositivo
FROM codigos_colaborador cc
JOIN dispositivos_biometricos db ON db.id = cc.dispositivo_id
WHERE cc.colaborador_id = '<id del colaborador>';

-- Configuraciones de tarifa y horario
SELECT tipo, valor, unidad, vigente_desde
FROM configuraciones_reglas
WHERE colaborador_id = '<id del colaborador>';

-- Audit log
SELECT accion, descripcion, creado_en
FROM registros_auditoria
WHERE entidad_tipo = 'Colaborador' AND entidad_id = '<id del colaborador>';
```

---

## Escenario 2 — Registro mínimo sin opcionales (US1: colaborador sin tarifa ni código)

```bash
curl -s -b /tmp/cookies.txt -X POST https://jornalero.vercel.app/api/colaboradores \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "María",
    "apellido": "González",
    "cedula": "87654321",
    "area_id": "<UUID del área Bodega>",
    "supervisor_id": null
  }'
```

**Respuesta esperada** (HTTP 201 con warnings):
```json
{
  "colaborador": { "id": "...", ... },
  "configuraciones_creadas": [],
  "codigo_biometrico_creado": false,
  "warnings": [
    "Sin tarifa configurada: se usará la tarifa global vigente al momento de liquidar."
  ]
}
```

---

## Escenario 3 — Cédula duplicada (US2: rechazo)

```bash
# Mismo número de cédula que el Escenario 1
curl -s -b /tmp/cookies.txt -X POST https://jornalero.vercel.app/api/colaboradores \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Pedro",
    "apellido": "Otro",
    "cedula": "12345678",
    "area_id": "<UUID>"
  }'
```

**Respuesta esperada** (HTTP 409):
```json
{ "error": "DUPLICATE_CEDULA", "message": "Ya existe un colaborador con la cédula ingresada." }
```

---

## Escenario 4 — Workno duplicado en mismo dispositivo (US2: rechazo código)

```bash
curl -s -b /tmp/cookies.txt -X POST https://jornalero.vercel.app/api/colaboradores \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana",
    "apellido": "López",
    "cedula": "11111111",
    "area_id": "<UUID>",
    "codigo_biometrico": {
      "dispositivo_id": "6617cbbc-bac0-4abc-9815-197bd21ff38c",
      "workno": "9991234"
    }
  }'
```

**Respuesta esperada** (HTTP 201 con warning — el colaborador se crea pero sin el código):
```json
{
  "colaborador": { "id": "...", "nombre": "Ana", ... },
  "configuraciones_creadas": [],
  "codigo_biometrico_creado": false,
  "warnings": ["Código biométrico no asignado: workno '9991234' ya está activo en el dispositivo seleccionado."]
}
```

---

## Escenario 5 — Consulta de perfil del colaborador recién creado (US3)

```bash
curl -s -b /tmp/cookies.txt \
  https://jornalero.vercel.app/api/colaboradores/<id del colaborador>
```

**Respuesta esperada** (HTTP 200):
```json
{
  "id": "...",
  "nombre": "Juan",
  "apellido": "Pérez",
  "cedula": "12345678",
  "area": { "id": "...", "nombre": "Producción" },
  "supervisor": null,
  "activo": true,
  "tarifa_vigente": { "valor": 25000, "unidad": "COP", "vigente_desde": "2026-05-25" },
  "horario_vigente": { "umbral_horas_extra": 8, "vigente_desde": "2026-05-25" },
  "codigos_biometricos": [
    { "workno": "9991234", "dispositivo": { "nombre": "W1PRO" }, "activo": true }
  ]
}
```

---

## Escenario 6 — Verificar resolución biométrica inmediata (SC-004)

Con el colaborador del Escenario 1 registrado, enviar un webhook de prueba:

```bash
curl -X POST https://jornalero.vercel.app/api/webhooks/crosschex \
  -H "Content-Type: application/json" \
  -H "authorize-sign: TU_CROSSCHEX_WEBHOOK_SECRET" \
  -d '{
    "records": [{
      "uuid": "test-resolucion-inmediata-001",
      "device": { "serial_number": "0680200024340009", "name": "W1PRO" },
      "employee": { "workno": "9991234" },
      "check_time": "2026-05-26T14:00:00+00:00",
      "check_type": 0
    }]
  }'
```

**Verificar**: El evento debe tener `estado_resolucion = RESUELTO` y `colaborador_id` apuntando al colaborador recién creado.

```sql
SELECT estado_resolucion, colaborador_id
FROM eventos_biometricos
WHERE request_id = 'test-resolucion-inmediata-001';
-- estado_resolucion: RESUELTO
-- colaborador_id: <id de Juan Pérez>
```

---

## Obtener UUIDs de áreas y dispositivos

```bash
# Listar áreas disponibles
curl -s -b /tmp/cookies.txt https://jornalero.vercel.app/api/areas | jq '.areas'

# Listar dispositivos activos
curl -s -b /tmp/cookies.txt https://jornalero.vercel.app/api/dispositivos | jq '.dispositivos'
```
