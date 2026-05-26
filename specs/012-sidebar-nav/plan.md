# Implementation Plan: Sidebar de Navegación por Rol

**Branch**: `012-sidebar-nav` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)

**Input**: `specs/012-sidebar-nav/spec.md`

---

## Summary

Implementar el sidebar de navegación principal de la aplicación web. El sidebar filtra
las secciones visibles por rol del usuario (ADMINISTRADOR, SUPERVISOR, CAJERO, COLABORADOR),
resalta la sección activa por prefijo de URL, es responsive (drawer en mobile, panel fijo en
desktop), y muestra el nombre del usuario + logout en el pie. Además se implementa el
middleware de protección de rutas (spec 010) y el timer de expiración de sesión.

---

## Technical Context

**Language/Version**: TypeScript 5.x + Next.js 16 (App Router)

**Primary Dependencies**:
- MUI v5 (Material UI 5.15) + Emotion — ya instalados (`apps/web`)
- `jose` — ya instalada, edge-compatible, para JWT en middleware
- React Hook Form + Zod — no requeridos en esta feature

**Storage**: Sin cambios de BD — el sidebar lee `{ nombre, roles, exp }` del JWT payload

**Testing**: No hay test runner configurado en `apps/web`. Validación vía quickstart.md

**Target Platform**: Vercel (Edge Functions para middleware + Node.js para rutas)

**Performance Goals**: Sidebar renderiza sin latencia adicional (datos vienen del JWT, ya
verificado en el Server Component layout)

**Constraints**:
- `jose` DEBE usarse en middleware (edge-compatible). No usar `jsonwebtoken` ni `crypto` de Node.js
- El módulo `nav-config.ts` NO PUEDE importar nada de Node.js (debe ser edge-compatible)
- El sidebar reemplaza el `<header>` actual de `(app)/layout.tsx` — no convive con él

**Scale/Scope**: ~5 archivos nuevos o modificados

---

## Constitution Check

| Principio | Estado | Justificación |
|-----------|--------|---------------|
| I. Arquitectura Basada en Datos | ✅ PASS | Sin cambios de BD. El sidebar es UI puro. |
| II. Código Limpio y Crecimiento Modular | ✅ PASS | Nuevos componentes `layout/` sin tocar código existente. |
| III. Inmutabilidad Biométrica | ✅ PASS | No aplica — feature de UI. |
| IV. Cálculo Determinístico | ✅ PASS | No aplica — feature de UI. |
| V. Reglas Configurables | ✅ PASS | `NAV_ITEMS` en módulo separado, no hardcodeado en componentes. |
| VI. Ciclo Semanal | ✅ PASS | No aplica — feature de UI. |
| VII. Integración Biométrica | ✅ PASS | No aplica — feature de UI. |
| VIII. RBAC | ✅ PASS | Implementación directa del RBAC en UI + middleware. |
| IX. Trazabilidad de Ajustes | ✅ PASS | No aplica — feature de UI sin operaciones de escritura. |
| X. Disponibilidad en Tiempo Real | ✅ PASS | No aplica — navegación estática. |
| XI. Seguridad | ✅ PASS | Middleware verifica JWT antes de render. Cookie HttpOnly. |
| Restricciones Arquitectónicas — Responsive | ✅ PASS | Drawer mobile + panel desktop. |

**Veredicto**: Sin violaciones. Puede proceder a implementación.

---

## Project Structure

### Documentation (this feature)

```text
specs/012-sidebar-nav/
├── plan.md              ← este archivo
├── research.md          ← D1–D7 decisiones técnicas
├── contracts/
│   └── nav-config.md    ← contrato de NAV_ITEMS, AppSidebar, SessionTimer, middleware
├── quickstart.md        ← 10 escenarios de verificación
└── tasks.md             ← generado por /speckit-tasks
```

### Source Code

```text
apps/web/src/
├── middleware.ts                                    # NUEVO — protección de rutas (spec 010+012)
├── lib/
│   ├── auth-server.ts                               # SIN CAMBIOS
│   └── nav-config.ts                               # NUEVO — NAV_ITEMS + ROUTE_ROLES + PUBLIC_ROUTES
├── components/
│   ├── auth/
│   │   └── LogoutButton.tsx                        # SIN CAMBIOS — reutilizado en pie del sidebar
│   └── layout/
│       ├── AppSidebar.tsx                          # NUEVO — sidebar completo (desktop + mobile)
│       └── SessionTimer.tsx                        # NUEVO — timer de expiración de JWT
└── app/
    └── (app)/
        └── layout.tsx                              # MODIFICADO — reemplaza header por AppSidebar
```

---

## Implementation Decisions

### Decisión 1: Flujo de datos sesión → sidebar

```
(app)/layout.tsx (Server Component)
  ↓ lee cookie access_token
  ↓ verifyToken() → AuthPayload { nombre, roles, exp }
  ↓ props
<AppSidebar nombre={nombre} roles={roles} exp={exp} />  (Client Component)
  ↓ renderiza ítems filtrados + monta SessionTimer
<SessionTimer exp={exp} />  (Client Component)
  → setTimeout(redirect('/login?expired=1'), exp * 1000 - now)
```

### Decisión 2: Módulo NAV_ITEMS (fuente única de verdad)

```typescript
// apps/web/src/lib/nav-config.ts  (edge-compatible — solo objetos planos)

export const NAV_ITEMS = [
  { label: 'Inicio',               href: '/dashboard',     roles: ['ADMINISTRADOR','SUPERVISOR','CAJERO','COLABORADOR'] },
  { label: 'Colaboradores',        href: '/colaboradores', roles: ['ADMINISTRADOR'] },
  { label: 'Configuración',        href: '/configuracion', roles: ['ADMINISTRADOR'] },
  { label: 'Liquidaciones',        href: '/liquidaciones', roles: ['ADMINISTRADOR','SUPERVISOR'] },
  { label: 'Cola de Pagos',        href: '/pagos',         roles: ['ADMINISTRADOR','SUPERVISOR','CAJERO'] },
  { label: 'Usuarios del Sistema', href: '/usuarios',      roles: ['ADMINISTRADOR'] },
];

export const ROUTE_ROLES: Record<string, string[]> = {
  '/dashboard':     ['ADMINISTRADOR','SUPERVISOR','CAJERO','COLABORADOR'],
  '/colaboradores': ['ADMINISTRADOR'],
  '/configuracion': ['ADMINISTRADOR'],
  '/liquidaciones': ['ADMINISTRADOR','SUPERVISOR'],
  '/pagos':         ['ADMINISTRADOR','SUPERVISOR','CAJERO'],
  '/usuarios':      ['ADMINISTRADOR'],
};

export const PUBLIC_ROUTES = ['/login', '/auth', '/api/auth/login', '/api/webhooks'];
```

### Decisión 3: Layout con sidebar — estructura visual

```
┌─────────────────────────────────────────────┐
│  [Hamburger] Workforce        (mobile only) │  ← AppBar solo en mobile
├──────────┬──────────────────────────────────┤
│          │                                  │
│ SIDEBAR  │   {children}                     │
│ (240px)  │   Contenido de la sección activa │
│          │                                  │
│ ──────── │                                  │
│ Victor   │                                  │
│ [Logout] │                                  │
└──────────┴──────────────────────────────────┘
```

Desktop: sidebar permanente 240px + main con `ml: { md: '240px' }`.
Mobile: AppBar con hamburger + Drawer temporary superpuesto.

### Decisión 4: Indicador activo

```typescript
function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href;
  return pathname.startsWith(href);
}
```

### Decisión 5: Middleware

```typescript
// apps/web/src/middleware.ts
import { jwtVerify } from 'jose';
import { ROUTE_ROLES, PUBLIC_ROUTES } from './lib/nav-config';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas públicas — pasar sin verificar
  if (PUBLIC_ROUTES.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get('access_token')?.value;
  if (!token) return redirectToLogin(req, 'unauthorized');

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '...');
    const { payload } = await jwtVerify(token, secret);
    const roles = (payload.roles as string[]) ?? [];

    // Verificar rol requerido para la ruta
    const requiredRoles = Object.entries(ROUTE_ROLES).find(([prefix]) =>
      pathname.startsWith(prefix)
    )?.[1];

    if (requiredRoles && !requiredRoles.some(r => roles.includes(r))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  } catch {
    return redirectToLogin(req, 'expired');
  }
}
```

---

## Dependencies

- **spec 005**: Logout (`POST /api/auth/logout` + `<LogoutButton>`) — ya implementado ✅
- **spec 010**: Reglas de acceso por rol (mapa de secciones) — documentado en research ✅
- Sin dependencias de BD ni nuevas migraciones

## Out of Scope

- Iconos en los ítems del sidebar (future iteration)
- Personalización del menú por usuario
- Sub-navegación dentro de secciones (Configuración → sub-ítems)
- Secciones aún no implementadas (Configuración, Liquidaciones, Pagos, Usuarios) — el
  sidebar muestra los ítems pero las páginas destino no existen todavía
