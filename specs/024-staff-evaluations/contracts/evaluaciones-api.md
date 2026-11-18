# API Contract: Evaluaciones del Personal

**Feature**: 024-staff-evaluations | Base: Next.js Route Handlers en `apps/web/src/app/api`

Autenticación: cookie `access_token` (JWT). Respuestas de error comunes:

| Status | Body | Cuándo |
|---|---|---|
| 401 | `{ "error": "UNAUTHORIZED" }` | Sin token, token inválido/expirado/revocado o sesión invalidada |
| 403 | `{ "error": "FORBIDDEN", "required_roles": [...] }` | Rol insuficiente |
| 400 | `{ "error": "INVALID_JSON" }` | Body no es JSON |
| 422 | `{ "error": "<mensaje legible>" }` | Falla validación zod |

---

## A. Criterios (solo ADMINISTRADOR)

### GET `/api/configuracion/criterios-evaluacion`

Lista todos los criterios (activos e inactivos).

**200**
```json
{
  "criterios": [
    { "id": "uuid", "nombre": "Puntualidad", "descripcion": null, "peso": "25.00", "activo": true, "en_uso": true }
  ],
  "suma_activos": "100.00",
  "configuracion_valida": true
}
```
`en_uso` = el criterio tiene detalles de evaluación (solo informativo; nunca se puede eliminar).

### POST `/api/configuracion/criterios-evaluacion`

**Body**: `{ "nombre": string(1..100), "descripcion"?: string|null, "peso": number (0 < p ≤ 100, ≤ 2 decimales) }`

- **201** `{ "criterio": {...} }`
- **409** `{ "error": "Ya existe un criterio activo con ese nombre." }`

Auditoría: `CRITERIO_EVALUACION_CREADO`.

### PATCH `/api/configuracion/criterios-evaluacion/[id]`

**Body** (todos opcionales, al menos uno): `{ "nombre"?, "descripcion"?, "peso"?, "activo"? }`

- **200** `{ "criterio": {...} }`
- **404** `{ "error": "NOT_FOUND" }`
- **409** nombre duplicado entre activos (también si se reactiva y choca con otro activo).

No exige suma = 100 (research R4). Auditoría: `CRITERIO_EVALUACION_ACTUALIZADO`.

### PUT `/api/configuracion/criterios-evaluacion/pesos`

Redistribuye los pesos de todos los criterios activos en una sola transacción.

**Body**: `{ "pesos": [ { "id": "uuid", "peso": number } ] }` — debe incluir **exactamente** los criterios activos.

- **200** `{ "criterios": [...], "suma_activos": "100.00", "configuracion_valida": true }`
- **422** `{ "error": "Los pesos deben sumar 100%." }` o `{ "error": "Debe incluir todos los criterios activos." }`

Auditoría: `CRITERIO_EVALUACION_PESOS_ACTUALIZADOS`.

*(No hay DELETE: FR-007.)*

---

## B. Evaluaciones (ADMINISTRADOR o SUPERVISOR, salvo donde se indique)

### GET `/api/evaluaciones/colaboradores`

Pantalla principal (FR-017a).

**Query**: `q` (busca en nombre, apellido o cédula), `incluir_inactivos` (`true`|`false`, default `false`), `page` (default 1), `limit` (default 50, máx 200).

**200**
```json
{
  "total": 42, "page": 1, "limit": 50,
  "colaboradores": [
    {
      "id": "uuid", "nombre": "Juan", "apellido": "Pérez", "cedula": "1234567",
      "activo": true,
      "puntaje_promedio": "7.85",
      "total_evaluaciones": 3,
      "ultima_evaluacion": "2026-11-10"
    }
  ]
}
```
`puntaje_promedio` y `ultima_evaluacion` consideran solo evaluaciones VIGENTES; son `null` si no tiene ninguna. Orden: apellido, nombre.

### GET `/api/evaluaciones/criterios-vigentes`

Datos para armar el formulario de nueva evaluación.

**200**
```json
{
  "criterios": [ { "id": "uuid", "nombre": "Puntualidad", "descripcion": null, "peso": "25.00" } ],
  "suma_activos": "100.00",
  "configuracion_valida": true,
  "config_version": "sha256-hex"
}
```

### POST `/api/evaluaciones`

**Body**
```json
{
  "colaborador_id": "uuid",
  "fecha_evaluacion": "2026-11-18",
  "comentario": "opcional, ≤ 1000 chars",
  "config_version": "sha256-hex",
  "puntajes": [ { "criterio_id": "uuid", "puntaje": 8 } ]
}
```
Validaciones: `puntaje` entero 1–10; `fecha_evaluacion` ≤ hoy (GMT-4); un puntaje por cada criterio activo, sin repetidos ni sobrantes.

- **201** `{ "evaluacion": <EvaluacionDetalle> }`
- **404** `{ "error": "COLABORADOR_NOT_FOUND" }`
- **409** `{ "error": "COLABORADOR_INACTIVO" }`
- **409** `{ "error": "CRITERIOS_NO_SUMAN_100" }` — FR-005
- **409** `{ "error": "CRITERIOS_CAMBIARON" }` — `config_version` no coincide; el cliente debe recargar el formulario
- **422** `{ "error": "Faltan puntajes para: Orden, Respeto." }`

Transacción: verifica criterios con `SELECT ... FOR SHARE`, recalcula `config_version`, inserta el encabezado y los detalles (con snapshot), calcula `puntaje_final` y audita `EVALUACION_REGISTRADA`.

### GET `/api/evaluaciones/colaboradores/[colaboradorId]`

Histórico del trabajador (FR-014, FR-016). Incluye inactivos.

**200**
```json
{
  "colaborador": { "id": "uuid", "nombre": "Juan", "apellido": "Pérez", "cedula": "1234567", "activo": true },
  "resumen": { "puntaje_promedio": "7.85", "total_vigentes": 3, "ultima_evaluacion": "2026-11-10" },
  "evaluaciones": [
    {
      "id": "uuid", "fecha_evaluacion": "2026-11-10", "creado_en": "ISO",
      "evaluador_nombre": "Ana Gómez", "puntaje_final": "8.25", "estado": "VIGENTE"
    }
  ]
}
```
Orden: `fecha_evaluacion DESC, creado_en DESC`. Si no existe: **404** `COLABORADOR_NOT_FOUND`.

### GET `/api/evaluaciones/[id]`

Detalle (FR-015). **200** `{ "evaluacion": <EvaluacionDetalle> }` / **404**.

```json
// EvaluacionDetalle
{
  "id": "uuid",
  "colaborador": { "id": "uuid", "nombre": "Juan", "apellido": "Pérez" },
  "fecha_evaluacion": "2026-11-10",
  "creado_en": "ISO",
  "evaluador_nombre": "Ana Gómez",
  "puntaje_final": "8.25",
  "comentario": "…",
  "estado": "ANULADA",
  "anulacion": { "motivo": "Trabajador equivocado", "anulada_por_nombre": "Admin", "anulada_en": "ISO" },
  "detalles": [ { "criterio_nombre": "Puntualidad", "peso": "25.00", "puntaje": 9 } ]
}
```
`anulacion` es `null` si está vigente.

### POST `/api/evaluaciones/[id]/anular` — solo ADMINISTRADOR

**Body**: `{ "motivo": string(1..500) }`

- **200** `{ "evaluacion": <EvaluacionDetalle> }`
- **403** si no es ADMINISTRADOR
- **404** `NOT_FOUND`
- **409** `{ "error": "YA_ANULADA" }`

Auditoría: `EVALUACION_ANULADA`.

*(No existe PUT/PATCH sobre evaluaciones: FR-013.)*
