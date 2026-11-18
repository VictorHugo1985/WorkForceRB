# Implementation Plan: Registro de Accesos (Login Audit Log)

**Branch**: `023-login-audit-log` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-login-audit-log/spec.md`

## Summary

Exponer el historial de accesos (logins) que ya se registra en `registros_auditoria`
(`LOGIN_EXITOSO` / `LOGIN_FALLIDO`) a través de una nueva sección en el sidebar visible
únicamente para el rol ADMINISTRADOR. Incluye una API de consulta con filtros y una vista
paginada en el frontend.

## Technical Context

**Language/Version**: TypeScript — Node.js 20 (Next.js 16.2.6)

**Primary Dependencies**: Next.js 16 App Router, MUI v5 (Material UI 5), `pg` (pool), `jose` (JWT)

**Storage**: PostgreSQL — tabla `registros_auditoria` existente (columnas relevantes: `id`, `usuario_id`, `accion`, `descripcion`, `ip_origen`, `creado_en`)

**Testing**: Manual (no hay suite automatizada activa)

**Target Platform**: Web server (Vercel / Node.js serverless)

**Project Type**: Web application — monorepo, cambios solo en `apps/web`

**Performance Goals**: Listado de accesos carga en < 2 s para los 100 registros más recientes

**Constraints**: Sin cambios al modelo de datos ni al flujo de autenticación existente

**Scale/Scope**: Equipo pequeño (< 50 usuarios), volumen de registros moderado

## Constitution Check

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Arquitectura basada en datos | ✅ | Sin cambios al esquema; reutiliza `registros_auditoria` |
| II. Código limpio y modular | ✅ | Nuevo módulo `/accesos` independiente, sin tocar código existente |
| VIII. RBAC | ✅ | Sección visible y accesible solo para ADMINISTRADOR |
| IX. Trazabilidad obligatoria | ✅ | El login ya registra eventos; esta feature los expone |
| XI. Seguridad | ✅ | Guard de rol en page server-side + API route |

**Veredicto**: Sin violaciones. Puede avanzar a implementación.

## Project Structure

### Documentation (this feature)

```text
specs/023-login-audit-log/
├── plan.md              ← este archivo
├── research.md
├── data-model.md
├── contracts/
│   └── accesos-api.md
└── tasks.md             (generado por /speckit-tasks)
```

### Source Code

```text
apps/web/src/
├── lib/
│   └── nav-config.ts                          ← agregar entrada /accesos (ADMINISTRADOR)
├── app/
│   ├── (app)/
│   │   └── accesos/
│   │       └── page.tsx                       ← nuevo (server component, guard ADMINISTRADOR)
│   └── api/
│       └── accesos/
│           └── route.ts                       ← nuevo (GET con filtros)
└── components/
    └── accesos/
        └── AccesosListClient.tsx              ← nuevo (tabla MUI + filtros)
```

**Structure Decision**: Un solo módulo `accesos` auto-contenido. Sin tocar código existente
salvo `nav-config.ts` (agregar la entrada de navegación).

## Phase 0: Research

### Decisión 1 — Fuente de datos

**Decision**: Reutilizar `registros_auditoria` filtrando `accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')`.

**Rationale**: El route `/api/auth/login` ya inserta ambos eventos con `usuario_id`, `ip_origen`, `descripcion` y `creado_en`. No es necesario crear una tabla nueva.

**Alternatives considered**: Tabla dedicada `accesos_sesion` — descartada por violar el principio de no modificar el modelo de datos cuando la información ya existe.

### Decisión 2 — Paginación y filtros en API

**Decision**: `GET /api/accesos` con query params `?usuario_id=&resultado=&desde=&hasta=&page=&limit=`.
Paginación offset-based (simple, adecuada para el volumen esperado).

**Rationale**: Patrón consistente con el resto de los routes (`/api/usuarios`, `/api/colaboradores`).

### Decisión 3 — Guard de ruta en el page

**Decision**: Mismo patrón que `UsuariosPage`: verificar token en server component, `redirect('/dashboard')` si no es ADMINISTRADOR.

**Rationale**: No hay middleware activo; el patrón establecido es guard en el server component.

## Phase 1: Design & Contracts

### Data Model (`data-model.md`)

No se crea ni modifica ninguna tabla. Los datos provienen de:

```sql
SELECT
  ra.id,
  ra.creado_en,
  ra.accion,          -- 'LOGIN_EXITOSO' | 'LOGIN_FALLIDO'
  ra.ip_origen,
  ra.descripcion,
  ra.usuario_id,
  u.nombre,
  u.apellido,
  u.email
FROM registros_auditoria ra
LEFT JOIN usuarios u ON u.id = ra.usuario_id
WHERE ra.accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')
ORDER BY ra.creado_en DESC
```

Filtros opcionales acumulables:
- `usuario_id` → `AND ra.usuario_id = $n`
- `resultado` (`exitoso` | `fallido`) → `AND ra.accion = $n`
- `desde` / `hasta` → `AND ra.creado_en >= $n AND ra.creado_en <= $n`

### API Contract

**Endpoint**: `GET /api/accesos`

**Auth**: Cookie `access_token` con rol `ADMINISTRADOR` (via `checkAdminRole`).

**Query params**:

| Param | Tipo | Descripción |
|-------|------|-------------|
| `usuario_id` | UUID (opcional) | Filtrar por usuario específico |
| `resultado` | `exitoso` \| `fallido` (opcional) | Filtrar por resultado |
| `desde` | ISO 8601 date (opcional) | Fecha inicio del rango |
| `hasta` | ISO 8601 date (opcional) | Fecha fin del rango |
| `page` | number (default 1) | Página actual |
| `limit` | number (default 50, max 200) | Registros por página |

**Response 200**:
```json
{
  "total": 143,
  "page": 1,
  "limit": 50,
  "accesos": [
    {
      "id": "uuid",
      "creado_en": "2026-06-20T10:30:00Z",
      "resultado": "exitoso",
      "ip_origen": "192.168.1.10",
      "descripcion": "Inicio de sesión exitoso",
      "usuario_id": "uuid | null",
      "usuario_nombre": "Miguel Torres | null",
      "usuario_email": "miguel@rosabetania.com | null"
    }
  ]
}
```

**Response 401**: No autenticado → `{ "error": "UNAUTHORIZED" }`
**Response 403**: Sin rol ADMINISTRADOR → `{ "error": "FORBIDDEN" }`

### Componente `AccesosListClient`

- Tabla MUI con columnas: Fecha/Hora, Usuario (nombre + email), Resultado (chip verde/rojo), IP, Descripción
- Barra de filtros: selector de usuario (Autocomplete), selector de resultado (Select), rango de fechas (dos DatePicker)
- Paginación MUI (`TablePagination`)
- Estado de carga (Skeleton) y estado vacío

### Navegación

Agregar en `nav-config.ts`:
```ts
{ label: 'Accesos', href: '/accesos', roles: ['ADMINISTRADOR'] }
```
Y en `ROUTE_ROLES`:
```ts
'/accesos': ['ADMINISTRADOR'],
```
