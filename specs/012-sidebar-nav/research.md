# Research: Sidebar de Navegación por Rol

**Feature**: 012-sidebar-nav | **Date**: 2026-05-26

---

## D1 — Pipeline de sesión hacia el sidebar

**Decision**: El Server Component `(app)/layout.tsx` lee el JWT del cookie `access_token`
con `verifyToken()`, extrae `{ nombre, roles, exp }` del payload, y los pasa como props
al Client Component `<AppSidebar>`. No se re-expone el JWT completo al cliente.

**Rationale**: `AuthPayload` ya tiene todos los campos necesarios (`nombre`, `roles`, `exp`).
El layout existente ya ejecuta `verifyToken()` en servidor y redirige si no hay sesión.
Esta mecánica no añade latencia (ya se hace hoy en el layout).

**Alternatives considered**:
- Llamada client-side a `/api/auth/me` — añade latencia y un round-trip extra; innecesario.
- Context global (Zustand) — overhead de estado global para datos que solo cambian al login.

---

## D2 — Indicador de sección activa

**Decision**: `usePathname()` de `next/navigation` en el Client Component sidebar.
Regla de comparación: `pathname === item.href` para Inicio (`/dashboard`);
`pathname.startsWith(item.href)` para el resto. Esto activa "Colaboradores" cuando
el usuario está en `/colaboradores/nuevo` o `/colaboradores/[id]`.

**Rationale**: `usePathname()` es el hook oficial de Next.js App Router para leer la
URL activa en client components. La comparación por prefijo cumple el requisito de
FR-004 (sub-páginas activan la sección padre). La excepción para `/dashboard` evita
falsos positivos (p.ej., `/dashboard/...` podría activar todas las secciones si no
se distingue la raíz).

**Alternatives considered**:
- Leer `pathname` en Server Component — no es reactivo; no se actualiza con navegación
  client-side sin reload completo.
- Pasar `active` como prop desde el layout — requeriría server round-trip en cada
  navegación.

---

## D3 — Sidebar responsive: desktop permanente + mobile drawer

**Decision**: Un único componente `<AppSidebar>` que renderiza:
- **Desktop**: MUI `<Drawer variant="permanent">` — visible siempre, fijo a la izquierda.
- **Mobile**: MUI `<Drawer variant="temporary">` — superpuesto, controlado por estado
  `open` + botón hamburger en el header superior.

Estado `mobileOpen: boolean` gestionado en `<AppSidebar>`. El botón hamburger llama a
`setMobileOpen(true)`. Seleccionar un ítem o clickar fuera llama a `setMobileOpen(false)`.

Breakpoint de cambio: MUI `md` (900px). Por encima → permanent drawer. Por debajo → temporary.

**Rationale**: MUI Drawer soporta ambos `variant` con la misma API. Los breakpoints de MUI
son consistentes con el sistema de diseño ya instalado (MUI v5). Sin dependencias adicionales.

**Alternatives considered**:
- Dos componentes separados — duplicación de lógica de items y filtrado.
- CSS puro (`hidden md:block`) — no disponible (proyecto usa MUI, no Tailwind en app).

---

## D4 — Fuente única de verdad: NAV_ITEMS y ROUTE_ROLES

**Decision**: Un módulo `apps/web/src/lib/nav-config.ts` exporta:
- `NAV_ITEMS`: array con `{ label, href, roles[] }` para el sidebar.
- `ROUTE_ROLES`: record `Record<string, string[]>` (prefijo de ruta → roles permitidos)
  para el middleware.

Ambos comparten la misma lista de roles por sección. El módulo contiene solo objetos
planos (sin imports de Node.js) → compatible con Edge Runtime del middleware.

**Rationale**: Spec 010 decidió tabla estática en `middleware.ts`; spec 012 necesita
los mismos datos en el sidebar. Duplicar introduce riesgo de divergencia. Un módulo
edge-compatible compartido resuelve ambas necesidades con una sola fuente de verdad.

**Alternatives considered**:
- Duplicar en `middleware.ts` y en el sidebar — riesgo de divergencia al añadir secciones.
- Base de datos para permisos dinámicos — overhead innecesario para MVP; los roles son fijos.

---

## D5 — Timer de expiración de sesión (spec 010 FR-006)

**Decision**: Client Component `<SessionTimer exp={number} />`.
Lógica: `useEffect(() => { const delay = exp * 1000 - Date.now(); if (delay <= 0) { router.replace('/login?expired=1'); return; } const t = setTimeout(() => router.replace('/login?expired=1'), delay); return () => clearTimeout(t); }, [exp])`.

El prop `exp` (Unix timestamp en segundos del JWT) se pasa desde el Server Component layout.
`JWT_TTL_SECONDS = 7200` (2 horas), por lo que el timer se dispara exactamente cuando el
token expira, sin polling.

**Rationale**: Sin overhead de polling. Sin llamadas a API. El JWT ya tiene `exp` en su payload.
El redirect incluye `?expired=1` para que la página de login muestre el mensaje apropiado.

**Alternatives considered**:
- Polling a `/api/auth/me` — overhead innecesario y latencia de red.
- Detección pasiva en 401 — solo actúa cuando el usuario hace una acción; el timer actúa
  antes de que el usuario intente algo con un token expirado.

---

## D6 — Middleware de protección de rutas (spec 010 FR-004/FR-005)

**Decision**: `apps/web/src/middleware.ts` usando `jose` (ya instalado, edge-compatible).
Lee cookie `access_token`, llama `jwtVerify()`, extrae `roles` del payload, verifica
contra `ROUTE_ROLES` de `nav-config.ts`.

Rutas públicas (no protegidas): `/login`, `/auth/*`, `/api/auth/login`, `/api/webhooks/*`.
Sin sesión válida → redirect a `/login?reason=unauthorized`.
Con sesión pero sin rol → redirect a `/dashboard`.

**Rationale**: `jose` ya es la librería de JWT del proyecto (usada en `auth-server.ts`) y
es compatible con Edge Runtime (no usa Node.js APIs). Centralizar la protección en middleware
evita verificaciones duplicadas en cada layout de sección.

**Alternatives considered**:
- Verificación en cada layout de sección — código duplicado y riesgo de dejar rutas sin proteger.
- `next-auth` — overhead de adoptar una librería nueva que reemplazaría el sistema JWT actual.

---

## D7 — Logout desde sidebar

**Decision**: La opción "Cerrar sesión" en el pie del sidebar llama al endpoint existente
`POST /api/auth/logout` y redirige a `/login`. Se reutiliza el componente `<LogoutButton>`
ya implementado en `apps/web/src/components/auth/LogoutButton.tsx` (spec 005).

**Rationale**: El logout ya está implementado y probado. No es necesario reimplementarlo.
El sidebar simplemente renderiza `<LogoutButton>` en su sección de pie.

**Alternatives considered**:
- Logout directamente en el sidebar sin API — requeriría manipular cookies desde el cliente,
  lo que viola la política HttpOnly del cookie `access_token`.
