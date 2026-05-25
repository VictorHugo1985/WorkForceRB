# Implementation Plan: Navegación de la Aplicación Web por Rol

**Branch**: `010-role-based-nav` | **Date**: 2026-05-22 | **Spec**: [spec.md](spec.md)

## Summary

Implementar el app shell de la aplicación web con navegación filtrada por rol, protección de rutas y gestión de sesión integrada. La solución combina Next.js middleware (verificación de autenticación) con layout guards (verificación de autorización por rol), un `NAV_CONFIG` centralizado como fuente única de verdad para permisos de navegación, y Zustand para el estado de sesión del cliente.

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**:
- Next.js 14 (App Router, middleware, route groups)
- MUI v5 (Material UI 5.15) + Emotion 11 — AppBar, Drawer, List
- Zustand — estado de sesión cliente
- Axios — peticiones HTTP al backend
- `@workforce/database` — tipos de rol (RolUsuario enum)

**Storage**: Sin nuevas tablas. Usa sesión JWT en HttpOnly cookie (spec 005) y sessionStorage para hidratación del cliente.

**Testing**: Jest + React Testing Library (unit: guards, config; integration: navegación por rol)

**Target Platform**: Browser (Next.js web app, apps/web)

**Performance Goals**: Transición entre secciones < 200ms (solo navegación cliente, sin refetch de sesión)

**Constraints**:
- Roles leídos únicamente de la sesión activa; cambios efectivos en el próximo login.
- Cookie HttpOnly: acceso solo desde server components o endpoint proxy `/auth/me`.
- URL preservation via query param `?redirect=` exclusivamente.

**Scale/Scope**: 4 roles, 6 secciones, ~10 rutas protegidas en MVP.

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Arquitectura Basada en Datos | ✅ | Sin nuevas tablas; usa esquema de spec 003/009 |
| II. Código Limpio y Modular | ✅ | NAV_CONFIG centralizado; guards reutilizables |
| VIII. RBAC | ⚠️ NOTA | Constitution menciona solo ADMINISTRADOR/SUPERVISOR. Spec 009 y 010 añaden CAJERO y COLABORADOR. Requiere enmienda a constitution (MINOR bump) antes de implementar. |
| XI. Seguridad y Protección de Datos | ✅ | JWT en HttpOnly cookie, protección de rutas en middleware |
| Restricciones — Responsive / Mobile-first | ✅ | MUI Drawer responde a breakpoints; diseño mobile-first |

> **GATE ⚠️**: La constitution (Principio VIII) actualmente solo menciona dos roles. Antes de implementar, el responsable técnico debe aprobar la enmienda que añade CAJERO y COLABORADOR al catálogo de roles del sistema (ver spec 009, Assumptions).

## Project Structure

### Documentation (this feature)

```text
specs/010-role-based-nav/
├── plan.md          ← este archivo
├── research.md      ← decisiones técnicas
├── data-model.md    ← modelos de aplicación y mapa de rutas
├── contracts/
│   └── api.md       ← contratos API, NAV_CONFIG, AuthStore
└── tasks.md         ← (generado por /speckit-tasks)
```

### Source Code

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx              # App shell + session guard + role guard
│   │       ├── page.tsx                # / → Inicio
│   │       ├── colaboradores/
│   │       │   └── page.tsx
│   │       ├── configuracion/
│   │       │   └── page.tsx
│   │       ├── liquidaciones/
│   │       │   └── page.tsx
│   │       ├── pagos/
│   │       │   └── page.tsx
│   │       └── usuarios/
│   │           └── page.tsx
│   ├── middleware.ts                   # Auth check → redirect a /login?redirect=
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx            # Client: AppBar + Drawer container
│   │   │   ├── Sidebar.tsx             # Client: nav items filtrados por rol
│   │   │   ├── NavItem.tsx             # Item individual del menú
│   │   │   └── UserMenu.tsx            # Nombre + roles + logout
│   │   └── auth/
│   │       └── SessionInitializer.tsx  # Client: hidrata Zustand desde server
│   ├── lib/
│   │   ├── navigation/
│   │   │   ├── config.ts               # NAV_CONFIG, tipos NavSection, RolUsuario
│   │   │   └── guards.ts               # canAccess(), getAccessLevel()
│   │   └── stores/
│   │       └── auth-store.ts           # Zustand AuthStore
│   └── hooks/
│       └── use-auth.ts                 # Hook cliente: acceso al AuthStore
└── tests/
    ├── unit/
    │   ├── navigation/config.test.ts   # Pruebas del NAV_CONFIG y guards
    │   └── stores/auth-store.test.ts
    └── integration/
        └── route-protection.test.ts   # Acceso a rutas por combinación de roles
```

**Structure Decision**: Web application (Option 2 simplificado — solo `apps/web`). Sin cambios en `apps/api` salvo verificar que `GET /auth/me` retorna el payload esperado (spec 005).

## Implementation Phases

### Fase A — Configuración Base (Prerequisito)

1. Verificar que la enmienda de spec 009 al modelo de datos esté aplicada: `RolUsuario` enum tiene `CAJERO` y `COLABORADOR`; `UsuarioSistema` soporta múltiples roles.
2. Verificar que `GET /auth/me` en NestJS retorna `{ id, email, nombre, roles: RolUsuario[] }`.

### Fase B — Core Navigation Config

1. Crear `lib/navigation/config.ts` con `NAV_CONFIG` y tipos.
2. Crear `lib/navigation/guards.ts` con `canAccess()` y `getAccessLevel()`.
3. Crear `lib/stores/auth-store.ts` con Zustand AuthStore.
4. Tests unitarios para config y guards.

### Fase C — Middleware y Route Groups

1. Crear `middleware.ts`: verificar cookie de sesión; redirigir a `/login?redirect=<path>` si ausente.
2. Crear estructura de route groups `(auth)/` y `(app)/`.
3. Implementar `(app)/layout.tsx`: leer sesión, inicializar `SessionInitializer`, evaluar role guard para la ruta actual.

### Fase D — App Shell UI

1. Implementar `AppShell.tsx` con MUI AppBar + Drawer responsive.
2. Implementar `Sidebar.tsx` que filtra `NAV_CONFIG` con `getVisibleSections()`.
3. Implementar `UserMenu.tsx` con nombre del usuario, roles activos y botón de logout.
4. Implementar `NavItem.tsx` con indicador de sección activa (basado en pathname).

### Fase E — Inicio Page y Tests de Integración

1. Implementar `/page.tsx` (Inicio): bienvenida estática + quick links filtrados por rol (FR-007B).
2. Tests de integración: acceso a rutas por cada rol y combinación de roles del mapa de spec 010.

## Complexity Tracking

| Decisión | Por qué necesaria | Alternativa rechazada |
|----------|------------------|-----------------------|
| Doble capa (middleware + layout guard) | El middleware no tiene contexto de payload para lógica multi-rol compleja | Solo middleware: insuficiente para evaluar unión de roles |
| NAV_CONFIG centralizado | Fuente única de verdad para permisos de menú Y protección de rutas | Lógica distribuida en cada layout: riesgo de inconsistencia |
| sessionStorage para Zustand persist | Alinea vida útil del estado con la cookie de sesión no persistente | localStorage: persiste más allá de la sesión, inconsistencia con spec 005 |
