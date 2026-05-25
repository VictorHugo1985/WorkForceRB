# Data Model: Navegación por Rol

**Feature**: 010-role-based-nav  
**Date**: 2026-05-22

---

## Entidades de Base de Datos

Esta feature **no introduce nuevas entidades de base de datos**. El control de acceso usa entidades ya definidas en spec 003:

- `UsuarioSistema` — cuenta de sistema con roles asignados
- `RolUsuario` enum — valores requeridos: `ADMINISTRADOR`, `SUPERVISOR`, `CAJERO`, `COLABORADOR`

> **Nota**: La enmienda multi-rol de spec 009 (tabla `usuario_roles` o campo `roles[]` en `UsuarioSistema`) es prerequisito de esta feature. El campo `roles` debe ser una relación muchos-a-muchos.

---

## Modelos de Datos de Capa de Aplicación

### SessionPayload — Payload del JWT

```typescript
interface SessionPayload {
  sub: string;          // UsuarioSistema.id (UUID)
  email: string;
  nombre: string;
  roles: RolUsuario[];  // Array de roles; NUNCA vacío
  iat: number;
  exp: number;
}

type RolUsuario = 'ADMINISTRADOR' | 'SUPERVISOR' | 'CAJERO' | 'COLABORADOR';
```

**Constraints**:
- `roles` nunca es un array vacío (toda cuenta tiene al menos un rol — spec 009 FR-004).
- El payload es inmutable durante la sesión. Los cambios de rol tienen efecto en el próximo login.

---

### NavSection — Sección de Navegación

```typescript
interface NavSection {
  id: string;           // identificador único, e.g. 'liquidaciones'
  label: string;        // texto visible en el menú
  href: string;         // ruta de destino, e.g. '/liquidaciones'
  icon: string;         // nombre del ícono MUI
  roles: RolUsuario[];  // roles con acceso a esta sección
  accessLevel?: {       // diferenciación de nivel dentro de la sección
    [role in RolUsuario]?: 'full' | 'read-only';
  };
}
```

### Mapa de Navegación Canónico (NAV_CONFIG)

| id | label | href | roles con acceso | nivel |
|----|-------|------|-----------------|-------|
| `inicio` | Inicio | `/` | ADMINISTRADOR, SUPERVISOR, CAJERO, COLABORADOR | full |
| `colaboradores` | Colaboradores | `/colaboradores` | ADMINISTRADOR | full |
| `configuracion` | Configuración | `/configuracion` | ADMINISTRADOR | full |
| `liquidaciones` | Liquidaciones | `/liquidaciones` | ADMINISTRADOR, SUPERVISOR | full |
| `pagos` | Cola de Pagos | `/pagos` | ADMINISTRADOR, CAJERO, SUPERVISOR | ADMINISTRADOR: full · CAJERO: full · SUPERVISOR: read-only |
| `usuarios` | Usuarios del Sistema | `/usuarios` | ADMINISTRADOR | full |

---

### RouteGuard — Contrato de Evaluación de Acceso

```typescript
function canAccess(
  userRoles: RolUsuario[],
  requiredRoles: RolUsuario[]
): boolean {
  // true si el usuario tiene AL MENOS UNO de los roles requeridos
  return requiredRoles.some(r => userRoles.includes(r));
}

function getAccessLevel(
  userRoles: RolUsuario[],
  section: NavSection
): 'full' | 'read-only' | 'none' {
  if (!canAccess(userRoles, section.roles)) return 'none';
  if (!section.accessLevel) return 'full';
  // nivel más permisivo entre los roles del usuario
  const levels = userRoles
    .map(r => section.accessLevel?.[r])
    .filter(Boolean) as ('full' | 'read-only')[];
  return levels.includes('full') ? 'full' : 'read-only';
}
```

**Regla**: El usuario con múltiples roles obtiene el nivel más permisivo disponible entre sus roles para cada sección (spec 010 FR-002, US3-2).

---

## Estructura de Rutas Next.js App Router

```text
apps/web/src/app/
├── (auth)/
│   └── login/
│       └── page.tsx
│
└── (app)/
    ├── layout.tsx              # App shell: AppBar + Sidebar + session guard
    ├── page.tsx                # /  → Inicio
    ├── colaboradores/
    │   └── page.tsx            # /colaboradores
    ├── configuracion/
    │   └── page.tsx            # /configuracion
    ├── liquidaciones/
    │   └── page.tsx            # /liquidaciones
    ├── pagos/
    │   └── page.tsx            # /pagos
    └── usuarios/
        └── page.tsx            # /usuarios
```

**Route guard en `(app)/layout.tsx`**:
- Verifica sesión activa (cookie JWT válida).
- Lee `SessionPayload.roles`.
- Evalúa acceso a la ruta actual contra `NAV_CONFIG`.
- Redirige a `/` (Inicio) si la ruta es inaccesible para el rol.
- Redirige a `/login?redirect=<current-path>` si no hay sesión.

---

## Estado de Navegación en Cliente (Zustand)

```typescript
interface AuthStore {
  user: SessionPayload | null;
  isAuthenticated: boolean;
  setSession: (payload: SessionPayload | null) => void;
  hasRole: (role: RolUsuario) => boolean;
  canAccessSection: (sectionId: string) => boolean;
}
```

El store se inicializa en `SessionInitializer` (Client Component) a partir del payload pasado desde el layout servidor. Persiste en `sessionStorage` (se limpia al cerrar el browser, coherente con la política de sesión de spec 005).
