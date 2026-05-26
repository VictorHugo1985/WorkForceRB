# UI Contract: Configuración de Navegación

**Feature**: 012-sidebar-nav | **Type**: Shared module contract

---

## Módulo: `apps/web/src/lib/nav-config.ts`

Fuente única de verdad para la navegación por rol. Importable tanto desde el
middleware (Edge Runtime) como desde el sidebar (Client Component).

### `NAV_ITEMS`

Array ordenado de secciones del sistema. El orden determina el orden de aparición
en el sidebar.

```typescript
interface NavItem {
  label: string;   // Texto visible en el sidebar
  href: string;    // Ruta base de la sección (prefijo)
  roles: string[]; // Roles que tienen acceso a esta sección
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Inicio',               href: '/dashboard',     roles: ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'] },
  { label: 'Colaboradores',        href: '/colaboradores', roles: ['ADMINISTRADOR'] },
  { label: 'Configuración',        href: '/configuracion', roles: ['ADMINISTRADOR'] },
  { label: 'Liquidaciones',        href: '/liquidaciones', roles: ['ADMINISTRADOR', 'SUPERVISOR'] },
  { label: 'Cola de Pagos',        href: '/pagos',         roles: ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'] },
  { label: 'Usuarios del Sistema', href: '/usuarios',      roles: ['ADMINISTRADOR'] },
];
```

### `ROUTE_ROLES`

Mapa de prefijo de ruta a roles requeridos. Usado por el middleware para proteger rutas.

```typescript
const ROUTE_ROLES: Record<string, string[]> = {
  '/dashboard':     ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'],
  '/colaboradores': ['ADMINISTRADOR'],
  '/configuracion': ['ADMINISTRADOR'],
  '/liquidaciones': ['ADMINISTRADOR', 'SUPERVISOR'],
  '/pagos':         ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'],
  '/usuarios':      ['ADMINISTRADOR'],
};
```

### Rutas públicas (excluidas del middleware)

```typescript
const PUBLIC_ROUTES = ['/login', '/auth', '/api/auth/login', '/api/webhooks'];
```

---

## Componente: `<AppSidebar>`

**Archivo**: `apps/web/src/components/layout/AppSidebar.tsx`
**Tipo**: Client Component (`'use client'`)

### Props

```typescript
interface AppSidebarProps {
  nombre: string;   // Nombre completo del usuario autenticado
  roles: string[];  // Array de roles activos del usuario
  exp: number;      // JWT expiry (Unix timestamp en segundos)
}
```

### Comportamiento

- Filtra `NAV_ITEMS` → solo items donde `item.roles.some(r => roles.includes(r))`
- Indicador activo: `pathname === item.href` para `/dashboard`; `pathname.startsWith(item.href)` para el resto
- Desktop: `<Drawer variant="permanent">` siempre visible
- Mobile: `<Drawer variant="temporary">` con estado `mobileOpen`
- Pie: `nombre` truncado + `<LogoutButton />`
- Monta `<SessionTimer exp={exp} />`

---

## Componente: `<SessionTimer>`

**Archivo**: `apps/web/src/components/layout/SessionTimer.tsx`
**Tipo**: Client Component (`'use client'`)

### Props

```typescript
interface SessionTimerProps {
  exp: number; // JWT expiry (Unix timestamp en segundos)
}
```

### Comportamiento

- `useEffect`: calcula `delay = exp * 1000 - Date.now()`
- Si `delay <= 0`: redirige inmediatamente a `/login?expired=1`
- Si `delay > 0`: programa `setTimeout(() => router.replace('/login?expired=1'), delay)`
- Retorna `null` (sin render visible)

---

## Middleware: `apps/web/src/middleware.ts`

### Lógica de protección

```
Request entra
  → ¿Es ruta pública (PUBLIC_ROUTES)? → pasar sin verificación
  → Leer cookie `access_token`
  → ¿No existe? → redirect /login?reason=unauthorized (preservar URL destino en ?next=)
  → jwtVerify() con JWT_SECRET
  → ¿Falla verificación? → redirect /login?reason=expired
  → Extraer roles del payload
  → ¿Ruta en ROUTE_ROLES y ningún rol del usuario coincide? → redirect /dashboard
  → Pasar request
```

### Configuración de matcher

```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```
