# API Contract: Eventos Biométricos

**Feature**: 013-biometric-events-view | **Type**: REST endpoint

---

## `GET /api/eventos-biometricos`

Lista de eventos biométricos con filtrado server-side y paginación.

**Autenticación**: Cookie `access_token` válida. Roles permitidos: `ADMINISTRADOR`, `SUPERVISOR`.

### Query Parameters

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `fecha_desde` | `string (ISO date)` | No | Inicio del día actual GMT-4 | Fecha/hora de inicio del rango. Formato: `YYYY-MM-DD` |
| `fecha_hasta` | `string (ISO date)` | No | Fin del día actual GMT-4 | Fecha/hora de fin del rango (exclusive). Formato: `YYYY-MM-DD` |
| `colaborador` | `string` | No | — | Búsqueda parcial por nombre, cédula, o workno del empleado |
| `tipo_evento` | `string` | No | — | Filtro exacto: `ENTRADA`, `SALIDA`, o `DESCONOCIDO` |
| `dispositivo` | `string` | No | — | Nombre exacto del dispositivo |
| `estado` | `string` | No | — | Estado de resolución: `RESUELTO`, `SIN_RESOLVER`, `DISPOSITIVO_DESCONOCIDO` |
| `page` | `integer` | No | `1` | Número de página (base 1) |
| `page_size` | `integer` | No | `25` | Registros por página. Valores permitidos: 25, 50, 100 |

### Response 200 OK

```json
{
  "eventos": [
    {
      "id": "uuid",
      "checktime": "2026-05-26T08:05:23.000Z",
      "tipo_evento": "ENTRADA",
      "device_name": "Entrada Principal",
      "employee_workno": "0042",
      "display_nombre": "Ana García",
      "display_identificador": "12345678",
      "estado_resolucion": "RESUELTO"
    }
  ],
  "total": 342,
  "page": 1,
  "page_size": 25,
  "total_pages": 14
}
```

### Response 401 Unauthorized

Sin cookie `access_token` o token expirado.

```json
{ "error": "UNAUTHORIZED" }
```

### Response 403 Forbidden

Token válido pero rol no permitido (CAJERO o COLABORADOR).

```json
{ "error": "FORBIDDEN", "required_roles": ["ADMINISTRADOR", "SUPERVISOR"] }
```

---

## `GET /api/dispositivos`

Endpoint existente (spec 001). Devuelve la lista de dispositivos activos para poblar
el desplegable de filtro. Solo accesible para ADMINISTRADOR (existente).

**Nota**: Para la vista de eventos se reutiliza este endpoint. El filtro de dispositivo
en el UI poblará sus opciones con la respuesta de este endpoint.

> ⚠️ Consideración: El endpoint `/api/dispositivos` actualmente exige rol ADMINISTRADOR.
> En la implementación, el componente cliente intentará llamarlo y manejará el 403
> para SUPERVISOR degradando el filtro de dispositivo a un campo de texto libre,
> o se crea un endpoint separado accesible a ambos roles.

---

## UI Contract: `<EventosClient>`

**Archivo**: `apps/web/src/app/(app)/eventos/EventosClient.tsx`  
**Tipo**: Client Component (`'use client'`)

### Props

```typescript
interface EventosClientProps {
  dispositivos: { id: string; nombre: string }[]; // pre-cargados en el Server Component
}
```

### Estado interno (filtros)

```typescript
interface FiltrosState {
  fecha_desde: string;   // "YYYY-MM-DD"
  fecha_hasta: string;   // "YYYY-MM-DD"
  colaborador: string;
  tipo_evento: '' | 'ENTRADA' | 'SALIDA' | 'DESCONOCIDO';
  dispositivo: string;
  estado: '' | 'RESUELTO' | 'SIN_RESOLVER' | 'DISPOSITIVO_DESCONOCIDO';
  page: number;
  page_size: 25 | 50 | 100;
}
```

### Comportamiento

- Carga inicial: fetcha con filtros de fecha = hoy, página 1
- Al cambiar cualquier filtro: resetea `page` a 1, refetcha
- Al cambiar página: solo actualiza `page`, mantiene filtros
- Estados: cargando (skeleton), error (alert), vacío (mensaje), resultados (tabla)

---

## UI Contract: tabla de resultados

### Columnas

| Columna | Campo fuente | Notas |
|---------|-------------|-------|
| Fecha y Hora | `checktime` | Formateado: `DD/MM/YYYY HH:mm` (GMT-4) |
| Colaborador | `display_nombre` | workno si no resuelto, en gris |
| ID / Cédula | `display_identificador` | cédula si resuelto, workno si no |
| Tipo | `tipo_evento` | Chip de color: verde=ENTRADA, naranja=SALIDA, gris=DESCONOCIDO |
| Dispositivo | `device_name` | — |
| Estado | `estado_resolucion` | Chip: verde=RESUELTO, amarillo=SIN_RESOLVER, rojo=DISPOSITIVO_DESCONOCIDO |
