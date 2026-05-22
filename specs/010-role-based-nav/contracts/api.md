# Contracts: Navegación por Rol — API & Frontend Interfaces

**Feature**: 010-role-based-nav  
**Date**: 2026-05-22

---

## API Endpoint — GET /auth/me

Retorna la información de sesión del usuario autenticado. Usado por Client Components cuando no tienen acceso directo a la cookie HttpOnly.

**Method**: `GET`  
**Path**: `/auth/me`  
**Auth**: Cookie de sesión HttpOnly (obligatoria)

### Response 200 — OK

```json
{
  "id": "uuid",
  "email": "usuario@empresa.com",
  "nombre": "María González",
  "roles": ["SUPERVISOR", "CAJERO"]
}
```

**Fields**:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string (UUID)` | Identificador del UsuarioSistema |
| `email` | `string` | Correo electrónico (único, inmutable) |
| `nombre` | `string` | Nombre completo del usuario |
| `roles` | `RolUsuario[]` | Lista de roles activos. Nunca vacío. |

### Response 401 — Unauthorized

```json
{ "statusCode": 401, "message": "Unauthorized" }
```

Retornado cuando la cookie de sesión no está presente o ha expirado.

---

## Middleware Contract — Protección de Rutas

El `middleware.ts` de Next.js evalúa cada request entrante:

```typescript
// apps/web/src/middleware.ts
// Paths que NO requieren autenticación
const PUBLIC_PATHS = ['/login'];

// Lógica:
// 1. Si request.path en PUBLIC_PATHS → allow
// 2. Si no hay cookie de sesión → redirect a /login?redirect=<current-path>
// 3. Si hay cookie de sesión → allow (el layout evalúa el rol)
```

> **Nota**: El middleware solo verifica presencia de la cookie de sesión (verificación ligera). La validación del rol se hace en `(app)/layout.tsx` con acceso al payload completo.

---

## Frontend Contract — NAV_CONFIG

```typescript
// apps/web/src/lib/navigation/config.ts

export type RolUsuario = 'ADMINISTRADOR' | 'SUPERVISOR' | 'CAJERO' | 'COLABORADOR';
export type AccessLevel = 'full' | 'read-only';

export interface NavSection {
  id: string;
  label: string;
  href: string;
  icon: string;
  roles: RolUsuario[];
  accessLevel?: Partial<Record<RolUsuario, AccessLevel>>;
}

export const NAV_CONFIG: NavSection[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    href: '/',
    icon: 'HomeOutlined',
    roles: ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'COLABORADOR'],
  },
  {
    id: 'colaboradores',
    label: 'Colaboradores',
    href: '/colaboradores',
    icon: 'PeopleOutlined',
    roles: ['ADMINISTRADOR'],
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    href: '/configuracion',
    icon: 'SettingsOutlined',
    roles: ['ADMINISTRADOR'],
  },
  {
    id: 'liquidaciones',
    label: 'Liquidaciones',
    href: '/liquidaciones',
    icon: 'ReceiptLongOutlined',
    roles: ['ADMINISTRADOR', 'SUPERVISOR'],
  },
  {
    id: 'pagos',
    label: 'Cola de Pagos',
    href: '/pagos',
    icon: 'PaymentsOutlined',
    roles: ['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'],
    accessLevel: {
      ADMINISTRADOR: 'full',
      CAJERO: 'full',
      SUPERVISOR: 'read-only',
    },
  },
  {
    id: 'usuarios',
    label: 'Usuarios del Sistema',
    href: '/usuarios',
    icon: 'ManageAccountsOutlined',
    roles: ['ADMINISTRADOR'],
  },
];
```

---

## Frontend Contract — Zustand AuthStore

```typescript
// apps/web/src/lib/stores/auth-store.ts

import { NAV_CONFIG, RolUsuario } from '../navigation/config';

interface AuthState {
  user: {
    id: string;
    email: string;
    nombre: string;
    roles: RolUsuario[];
  } | null;
}

interface AuthActions {
  setSession: (user: AuthState['user']) => void;
  clearSession: () => void;
  hasRole: (role: RolUsuario) => boolean;
  getAccessLevel: (sectionId: string) => 'full' | 'read-only' | 'none';
  getVisibleSections: () => typeof NAV_CONFIG;
}
```

---

## Frontend Contract — SessionInitializer

```typescript
// apps/web/src/components/auth/SessionInitializer.tsx
// Client Component que hidrata el Zustand store desde el servidor

interface SessionInitializerProps {
  sessionData: {
    id: string;
    email: string;
    nombre: string;
    roles: RolUsuario[];
  } | null;
}
// Llama a useAuthStore().setSession(sessionData) en useEffect al montar.
// No renderiza UI propia.
```

---

## Redirect Contract — URL Preservation

```text
Flujo completo:

1. Usuario no autenticado accede a /liquidaciones
2. middleware.ts → redirect a /login?redirect=%2Fliquidaciones
3. Usuario completa login → NestJS devuelve sesión
4. Frontend lee query param ?redirect
5. Validación: ¿puede el usuario acceder a /liquidaciones con sus roles?
   - SÍ → router.push('/liquidaciones')
   - NO → router.push('/')
6. Si no hay ?redirect → router.push('/')
```

**Constraint**: La URL destino se lee solo del query param; nunca de sessionStorage ni localStorage.
