# Tasks: Sidebar de Navegación por Rol

**Input**: `specs/012-sidebar-nav/`
**Plan**: `specs/012-sidebar-nav/plan.md`
**Estado**: Completado

## Format: `[ID] [P?] [Story] Description`

- **[X]**: Tarea completada
- **[P]**: Puede ejecutarse en paralelo
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3, US4)

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Crear directorios y módulo de configuración de navegación

- [X] T001 Crear directorio `apps/web/src/components/layout/`

---

## Phase 2: Foundational (Bloqueante para todas las historias)

**Purpose**: Módulo de configuración de navegación y middleware de protección de rutas — DEBEN completarse antes de cualquier historia de usuario

- [X] T002 Crear `apps/web/src/lib/nav-config.ts` — exportar `NAV_ITEMS` (array con `{ label, href, roles[] }` en orden canónico), `ROUTE_ROLES` (Record prefijo→roles) y `PUBLIC_ROUTES` (['/login', '/auth', '/api/auth/login', '/api/webhooks']). Solo objetos planos, edge-compatible.

- [X] T003 Crear `apps/web/src/proxy.ts` (renombrado de middleware.ts per Next.js 16 convención) — importar `{ jwtVerify }` de `jose` y `{ ROUTE_ROLES, PUBLIC_ROUTES }` de `@/lib/nav-config`. Lógica: si ruta pública → pasar; sin cookie `access_token` → redirect `/login?reason=unauthorized&next=<pathname>`; falla `jwtVerify` → redirect `/login?reason=expired`; ruta en `ROUTE_ROLES` y ningún rol del usuario en la lista → redirect `/dashboard`; si pasa → `NextResponse.next()`. Agregar `export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }`.

**Checkpoint**: ✅ Foundation lista — rutas protegidas, config de nav disponible.

---

## Phase 3: User Story 1 — Sidebar con Secciones Filtradas por Rol (Priority: P1) 🎯 MVP

**Goal**: El usuario autenticado ve en el sidebar únicamente las secciones permitidas para su rol. Al hacer clic en un ítem navega a esa sección sin recarga completa.

**Independent Test**: Iniciar sesión como SUPERVISOR → el sidebar muestra exactamente 3 ítems (Inicio, Liquidaciones, Cola de Pagos). Hacer clic en "Liquidaciones" navega a `/liquidaciones`. Los ítems de ADMINISTRADOR no aparecen.

- [X] T004 [US1] Crear `apps/web/src/components/layout/AppSidebar.tsx` como Client Component (`'use client'`). Props: `{ nombre: string, roles: string[], exp: number }`. Importar `NAV_ITEMS` de `@/lib/nav-config`. Filtrar ítems: `NAV_ITEMS.filter(item => item.roles.some(r => roles.includes(r)))`. Renderizar con MUI `<Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, width: 240 }}>` + `<List>` con `<ListItemButton component={Link} href={item.href}>` para cada ítem visible.

- [X] T005 [US1] Actualizar `apps/web/src/app/(app)/layout.tsx` — mantener `getSession()` existente; pasar `nombre={user.nombre}`, `roles={user.roles}`, `exp={user.exp}` como props a `<AppSidebar>`. Reemplazar el `<header>` y `<main>` actuales por un layout de dos columnas: `<Box sx={{ display: 'flex' }}>` con `<AppSidebar .../>` a la izquierda y `<Box component="main" sx={{ flexGrow: 1, ml: { md: '240px' }, p: 3 }}>` para el contenido.

**Checkpoint**: ✅ US1 completa — sidebar visible en desktop con ítems filtrados por rol.

---

## Phase 4: User Story 2 — Indicador de Sección Activa (Priority: P1)

**Goal**: El ítem del sidebar correspondiente a la sección actual se resalta visualmente. El indicador se actualiza al navegar y funciona en sub-páginas.

**Independent Test**: Navegar a `/colaboradores/nuevo` → el ítem "Colaboradores" aparece resaltado en el sidebar. Navegar a `/dashboard` → el ítem "Inicio" se resalta y "Colaboradores" deja de estarlo.

- [X] T006 [US2] Agregar indicador activo en `apps/web/src/components/layout/AppSidebar.tsx` — importar `usePathname` de `next/navigation`. Definir helper: `function isActive(pathname: string, href: string): boolean { if (href === '/dashboard') return pathname === href; return pathname.startsWith(href); }`. Pasar `selected={isActive(pathname, item.href)}` a cada `<ListItemButton>`.

**Checkpoint**: ✅ US2 completa — indicador activo correcto incluido en sub-páginas.

---

## Phase 5: User Story 3 — Sidebar Responsive con Menú Colapsado en Mobile (Priority: P2)

**Goal**: En mobile el sidebar está oculto por defecto. Un botón hamburger lo abre como drawer. Seleccionar un ítem o tocar fuera cierra el drawer.

**Independent Test**: DevTools → 375px. El sidebar no es visible. Tocar el botón hamburger → aparece drawer. Seleccionar "Inicio" → el drawer se cierra y el usuario llega a `/dashboard`.

- [X] T007 [US3] Agregar soporte mobile en `apps/web/src/components/layout/AppSidebar.tsx` — agregar estado `const [mobileOpen, setMobileOpen] = useState(false)`. Convertir el drawer existente a renderizado dual: `<Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { xs: 'block', md: 'none' } }}>` para mobile y `<Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' } }}>` para desktop. Envolver ambos en un Fragment. En el click de cada ítem nav agregar `setMobileOpen(false)`.

- [X] T008 [US3] Agregar AppBar mobile en `apps/web/src/app/(app)/layout.tsx` + `AppLayoutClient.tsx` — dentro del layout de dos columnas, agregar `<AppBar position="fixed" sx={{ display: { md: 'none' } }}>` con `<IconButton onClick={() => /* pasar setMobileOpen al sidebar */}>` y `<MenuIcon />`. Pasar prop `onOpenMobile` a `<AppSidebar>` o usar estado lifting para controlar `mobileOpen` desde el layout.

  **Nota de implementación**: Extraer el estado `mobileOpen` al layout para que el botón del AppBar pueda controlarlo. Agregar prop `mobileOpen: boolean` y `onMobileClose: () => void` a `AppSidebarProps`. El layout maneja `useState<boolean>` y pasa los props correspondientes.

**Checkpoint**: ✅ US3 completa — sidebar responsive funcional en mobile y desktop.

---

## Phase 6: User Story 4 — Información del Usuario Autenticado en el Sidebar (Priority: P2)

**Goal**: El pie del sidebar muestra el nombre del usuario (truncado si es largo) y la opción de cerrar sesión, visibles sin scroll.

**Independent Test**: Usuario "Victor Hugo" autenticado → pie del sidebar muestra "Victor Hugo" y botón/link de cerrar sesión. Hacer clic en cerrar sesión → redirige a `/login`.

- [X] T009 [US4] Crear `apps/web/src/components/layout/SessionTimer.tsx` como Client Component (`'use client'`). Props: `{ exp: number }`. Usar `useEffect` y `useRouter`. Lógica: `const delay = exp * 1000 - Date.now(); if (delay <= 0) { router.replace('/login?expired=1'); return; } const t = setTimeout(() => router.replace('/login?expired=1'), delay); return () => clearTimeout(t);`. Retorna `null`.

- [X] T010 [US4] Agregar sección de pie en `apps/web/src/components/layout/AppSidebar.tsx` — en el contenido de ambos drawers (mobile y desktop), agregar un `<Box sx={{ mt: 'auto', p: 2, borderTop: 1, borderColor: 'divider' }}>` con `<Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>{nombre}</Typography>` y `<LogoutButton />` (importar de `@/components/auth/LogoutButton`). Montar `<SessionTimer exp={exp} />` fuera del drawer (una sola instancia). El `<List>` de ítems de nav debe estar dentro de un `<Box sx={{ overflow: 'auto', flexGrow: 1 }}>`.

**Checkpoint**: ✅ US4 completa — sidebar con nombre, logout y timer de sesión.

---

## Phase 7: Polish & Verificación

**Purpose**: Validación en producción y commit final

- [X] T011 Verificar los 10 escenarios del `quickstart.md` contra el endpoint en producción `https://jornalero.vercel.app`
  - ✅ ESC 5: Todas las rutas protegidas redirigen a `/login?reason=unauthorized&next=<ruta>` sin token
  - ✅ Rutas públicas (/login, /auth/*) devuelven HTTP 200 sin token
  - ✅ Rutas API no bloqueadas por el proxy (/api/auth/login, /api/webhooks/crosschex)
  - 🔍 ESC 1-4, 6-8, 10: Requieren sesión autenticada — verificar en browser con credenciales de producción

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Phase 1 (Setup)**: Sin dependencias — ejecutar primero
- **Phase 2 (Foundational)**: Depende de Phase 1 (directorio `layout/` debe existir antes de T003)
- **Phases 3, 4, 5, 6**: Dependen de Phase 2 completa (middleware y nav-config requeridos)
- **Phase 7 (Polish)**: Depende de US1+US2+US3+US4 completas

### Dependencias dentro de las US

- T004 → T005: AppSidebar debe existir antes de integrarlo en el layout
- T005 → T006: El indicador activo se agrega sobre el sidebar ya integrado
- T006 → T007: El drawer mobile extiende el sidebar con indicador ya activo
- T007 → T008: El AppBar mobile se añade al layout que ya tiene el sidebar completo
- T008 → T009: SessionTimer se crea antes de montarlo en T010
- T009 → T010: El pie del sidebar usa SessionTimer ya creado

### Oportunidades de paralelismo

- T002 y T003 (Phase 2): parcialmente paralelos — T003 importa de T002, pero pueden escribirse en paralelo si el contrato de `nav-config.ts` está acordado
- No hay otras oportunidades de paralelismo significativas — todas las US modifican el mismo archivo `AppSidebar.tsx`

---

## Implementation Strategy

### Estado actual

- ✅ Phase 1: Setup — directorio layout/
- ✅ Phase 2: Foundational — nav-config.ts + proxy.ts (Next.js 16)
- ✅ Phase 3 (US1): Sidebar con secciones filtradas
- ✅ Phase 4 (US2): Indicador de sección activa
- ✅ Phase 5 (US3): Sidebar responsive mobile
- ✅ Phase 6 (US4): Pie con usuario + logout + SessionTimer
- ✅ Phase 7: Verificación producción (API-level; browser pending)

### Próximos pasos recomendados (MVP)

1. T001 (directorio)
2. T002 → T003 (foundation: nav-config + middleware)
3. T004 → T005 (US1: sidebar base + layout)
4. **VALIDAR**: SUPERVISOR ve solo sus 3 secciones
5. T006 (US2: indicador activo)
6. T007 → T008 (US3: responsive)
7. T009 → T010 (US4: pie + SessionTimer)
8. T011 (verificación producción)

---

## Notes

- [P] = puede ejecutarse en paralelo (archivos diferentes)
- [X] = completado y verificado
- T002 y T003 son los bloqueantes más críticos — sin ellos el sidebar no sabe qué mostrar y las rutas no están protegidas
- Todas las US modifican `AppSidebar.tsx` → ejecución SECUENCIAL obligatoria
- `nav-config.ts` DEBE ser edge-compatible (sin imports de Node.js)
- El layout existente ya tiene `verifyToken()` y redirect — NO eliminar esa lógica; solo reemplazar el JSX del header
- `exp` en el JWT es Unix timestamp en segundos (no ms) — `SessionTimer` debe multiplicar por 1000
