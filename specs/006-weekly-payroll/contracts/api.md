# API Contracts: Gestión de Liquidación Semanal

**Feature**: 006-weekly-payroll | **Date**: 2026-05-25

**Auth requerida en todos los endpoints**: `JwtAuthGuard` — roles permitidos: `ADMINISTRADOR`, `SUPERVISOR`

> El SUPERVISOR solo puede operar sobre colaboradores asignados a su cargo (`colaboradores.supervisor_id = req.user.sub`).
> El ADMINISTRADOR puede operar sobre cualquier colaborador.
> El backend verifica este scope en `LiquidacionesService.assertScope(supervisorId, colaboradorId)`.

---

## GET /liquidaciones

**Descripción**: Obtener liquidación semanal de un colaborador para una semana específica, incluyendo todos los `DiaLiquidacion` del período y los bonos asignados.

### Request

```http
GET /liquidaciones?colaborador_id=<uuid>&semana_id=<uuid>
Cookie: access_token=<JWT>
```

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `colaborador_id` | `UUID` (query) | Sí | ID del colaborador |
| `semana_id` | `UUID` (query) | Sí | ID de la semana laboral |

### Responses

**200 OK**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "colaboradorId": "550e8400-e29b-41d4-a716-446655440002",
  "semanaId": "550e8400-e29b-41d4-a716-446655440003",
  "estado": "BORRADOR",
  "horasOrdinarias": 32.5,
  "horasExtra": 3.0,
  "valorHorasOrdinarias": 487.50,
  "valorHorasExtra": 67.50,
  "totalBonos": 40.00,
  "totalDescuentos": 50.00,
  "totalPago": 545.00,
  "aprobadoPor": null,
  "aprobadaEn": null,
  "calculadoEn": "2026-05-24T18:00:00Z",
  "dias": [
    {
      "id": "...",
      "fecha": "2026-05-18",
      "horasCalculadas": 8.5,
      "horasAjustadasSupervisor": null,
      "atrasoDetectado": false,
      "estadoDia": "SIN_REVISION",
      "motivoAjuste": null,
      "descuentoTipo": null,
      "descuentoValor": null,
      "descuentoMotivo": null
    },
    {
      "id": "...",
      "fecha": "2026-05-19",
      "horasCalculadas": 7.0,
      "horasAjustadasSupervisor": null,
      "atrasoDetectado": true,
      "estadoDia": "SIN_REVISION",
      "descuentoTipo": null,
      "descuentoValor": null,
      "descuentoMotivo": null,
      "motivoAjuste": null
    }
  ],
  "bonos": [
    {
      "id": "...",
      "fechaDia": "2026-05-18",
      "tipo": "TRANSPORTE",
      "monto": 20.00,
      "justificacion": null
    }
  ]
}
```

**404 Not Found** — Si no existe liquidación para ese colaborador y semana

```json
{
  "statusCode": 404,
  "message": "No existe liquidación para este colaborador en el período indicado",
  "error": "Not Found"
}
```

**403 Forbidden** — Supervisor intentando acceder a colaborador fuera de su scope

```json
{
  "statusCode": 403,
  "message": "No tiene acceso a este colaborador",
  "error": "Forbidden"
}
```

---

## PATCH /dias-liquidacion/:id

**Descripción**: Aplicar ajuste de horas, descuento diario, o aprobar un día. Devuelve el DiaLiquidacion actualizado y los totales recalculados de la LiquidacionSemanal padre.

### Request

```http
PATCH /dias-liquidacion/:id
Content-Type: application/json
Cookie: access_token=<JWT>
```

```json
{
  "horasAjustadasSupervisor": 7.0,
  "motivoAjuste": "Atraso de 60 minutos, se descuenta 1 hora",
  "descuentoTipo": "MONTO_FIJO",
  "descuentoValor": 50.00,
  "descuentoMotivo": "Anticipo de quincena",
  "aprobar": false
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `horasAjustadasSupervisor` | `number \| null` | No | ≥ 0; si presente, `motivoAjuste` es requerido |
| `motivoAjuste` | `string \| null` | Condicional | Requerido si `horasAjustadasSupervisor` present; maxLength 500 |
| `descuentoTipo` | `"TARIFA_DIA" \| "MONTO_FIJO" \| null` | No | Si presente, `descuentoValor` y `descuentoMotivo` son requeridos |
| `descuentoValor` | `number \| null` | Condicional | > 0; si `TARIFA_DIA`: bs/h ≤ tarifa_configurada; si `MONTO_FIJO`: importe bs |
| `descuentoMotivo` | `string \| null` | Condicional | Requerido si `descuentoTipo` present; maxLength 500 |
| `aprobar` | `boolean` | No | `true` = marcar día como APROBADO sin ajuste (supervisor decide no penalizar) |

*Al menos un campo debe estar presente. Enviar `descuentoTipo: null` elimina el descuento existente. Enviar `horasAjustadasSupervisor: null` elimina el ajuste de horas.*

### Responses

**200 OK**

```json
{
  "dia": {
    "id": "...",
    "fecha": "2026-05-19",
    "horasCalculadas": 7.0,
    "horasAjustadasSupervisor": 7.0,
    "atrasoDetectado": true,
    "estadoDia": "CON_DESCUENTO",
    "motivoAjuste": "Atraso de 60 minutos, se descuenta 1 hora",
    "descuentoTipo": "MONTO_FIJO",
    "descuentoValor": 50.00,
    "descuentoMotivo": "Anticipo de quincena"
  },
  "totales": {
    "horasOrdinarias": 31.5,
    "horasExtra": 3.0,
    "valorHorasOrdinarias": 472.50,
    "valorHorasExtra": 67.50,
    "totalBonos": 40.00,
    "totalDescuentos": 50.00,
    "totalPago": 530.00,
    "calculadoEn": "2026-05-25T10:30:00Z"
  }
}
```

**409 Conflict** — Liquidación ya aprobada

```json
{
  "statusCode": 409,
  "message": "La liquidación ya fue aprobada y no puede modificarse",
  "error": "Conflict"
}
```

**422 Unprocessable Entity** — Validación de negocio fallida

```json
{
  "statusCode": 422,
  "message": "motivoAjuste es requerido cuando se fijan horas ajustadas",
  "error": "Unprocessable Entity"
}
```

---

## POST /bonos

**Descripción**: Asignar un bono a un día específico del colaborador dentro del período.

### Request

```http
POST /bonos
Content-Type: application/json
Cookie: access_token=<JWT>
```

```json
{
  "colaboradorId": "550e8400-e29b-41d4-a716-446655440002",
  "semanaId": "550e8400-e29b-41d4-a716-446655440003",
  "fechaDia": "2026-05-18",
  "tipo": "TRANSPORTE",
  "monto": 20.00,
  "justificacion": null
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `colaboradorId` | `UUID` | Sí | FK válido |
| `semanaId` | `UUID` | Sí | FK válido; `fechaDia` debe caer dentro del período |
| `fechaDia` | `string (DATE)` | Sí | `YYYY-MM-DD`; dentro del período de `semanaId` |
| `tipo` | `"TRANSPORTE" \| "ALIMENTACION" \| "GENERICO"` | Sí | — |
| `monto` | `number` | Sí | > 0 |
| `justificacion` | `string \| null` | Condicional | Requerido si `tipo = GENERICO`; maxLength 500 |

### Responses

**201 Created**

```json
{
  "bono": {
    "id": "...",
    "colaboradorId": "...",
    "semanaId": "...",
    "fechaDia": "2026-05-18",
    "tipo": "TRANSPORTE",
    "monto": 20.00,
    "justificacion": null,
    "creadoEn": "2026-05-25T10:35:00Z"
  },
  "totales": {
    "totalBonos": 60.00,
    "totalPago": 550.00,
    "calculadoEn": "2026-05-25T10:35:00Z"
  }
}
```

**409 Conflict** — Bono duplicado (mismo tipo en mismo día)

```json
{
  "statusCode": 409,
  "message": "Ya existe un bono de tipo TRANSPORTE para este día. Edite el existente.",
  "error": "Conflict",
  "existingBonoId": "550e8400-e29b-41d4-a716-446655440099"
}
```

**409 Conflict** — Liquidación ya aprobada

```json
{
  "statusCode": 409,
  "message": "La liquidación ya fue aprobada y no puede modificarse",
  "error": "Conflict"
}
```

---

## PATCH /bonos/:id

**Descripción**: Editar el monto o justificación de un bono existente.

### Request

```http
PATCH /bonos/:id
Content-Type: application/json
Cookie: access_token=<JWT>
```

```json
{
  "monto": 25.00,
  "justificacion": "Ajuste por distancia recorrida"
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `monto` | `number` | No | > 0 |
| `justificacion` | `string \| null` | No | maxLength 500 |

### Responses

**200 OK**

```json
{
  "bono": { "id": "...", "monto": 25.00, "justificacion": "Ajuste por distancia recorrida" },
  "totales": { "totalBonos": 65.00, "totalPago": 555.00, "calculadoEn": "..." }
}
```

**409 Conflict** — Liquidación ya aprobada (ídem POST /bonos)

---

## DELETE /bonos/:id

**Descripción**: Eliminar un bono asignado (liquidación debe estar en BORRADOR).

### Request

```http
DELETE /bonos/:id
Cookie: access_token=<JWT>
```

### Responses

**200 OK**

```json
{
  "message": "Bono eliminado correctamente",
  "totales": { "totalBonos": 40.00, "totalPago": 530.00, "calculadoEn": "..." }
}
```

**409 Conflict** — Liquidación ya aprobada (ídem)

---

## POST /liquidaciones/:id/aprobar

**Descripción**: Aprobar la liquidación semanal de un colaborador. Transiciona de `BORRADOR` → `APROBADO`. Una vez aprobada, ninguna mutación es posible.

### Request

```http
POST /liquidaciones/:id/aprobar
Cookie: access_token=<JWT>
```

Sin body.

### Responses

**200 OK**

```json
{
  "id": "...",
  "estado": "APROBADO",
  "totalPago": 545.00,
  "aprobadoPor": "550e8400-e29b-41d4-a716-446655440000",
  "aprobadaEn": "2026-05-25T11:00:00Z"
}
```

**409 Conflict** — Ya estaba aprobada

```json
{
  "statusCode": 409,
  "message": "La liquidación ya fue aprobada anteriormente",
  "error": "Conflict"
}
```

**403 Forbidden** — Supervisor sin scope sobre el colaborador

---

## Notas de Implementación

### Naming Convention (camelCase en API, snake_case en DB)

El API usa camelCase en todos los request/response bodies. Prisma mapea a snake_case en DB via `@map` decorators. No se expone snake_case en ningún endpoint.

### Recálculo Completo en Cada Mutación

Cada `PATCH /dias-liquidacion/:id`, `POST /bonos`, `PATCH /bonos/:id`, y `DELETE /bonos/:id` retorna el bloque `totales` con los valores recalculados por `LiquidacionCalculatorService`. El frontend actualiza su estado local con estos valores autoritativos.

### Reglas de Negocio No Expuestas como Endpoints

- La creación del BORRADOR (FR-010) es interna: `LiquidacionesService.findOrCreateBorrador()` es llamada por el pipeline de spec 001, no por el frontend.
- La derivación de `estado_dia` es calculada por el backend en cada PATCH; el cliente nunca envía `estadoDia` directamente.
- La resolución de tarifa (`tarifa_configurada` por colaborador o global) es interna a `LiquidacionCalculatorService`.
