# Tasks: Registro de Accesos (Login Audit Log)

**Input**: Design documents from `/specs/023-login-audit-log/`

**Branch**: `023-login-audit-log`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: No solicitados — sin tareas de test automatizado.

**Organization**: Tareas agrupadas por user story para entrega incremental independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: User story a la que pertenece la tarea (US1, US2)
- Paths exactos incluidos en cada descripción

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Sin nueva infraestructura requerida. No hay nuevas dependencias de paquetes (reutiliza MUI v5 y `pg` ya instalados). No hay migraciones de base de datos.

> ✅ Listo para comenzar directamente en Phase 2.

---

## Phase 2: Foundational (Prerequisito bloqueante)

**Purpose**: Registrar la ruta `/accesos` en la configuración de navegación. Bloquea la visibilidad de la sección en el sidebar.

**⚠️ CRITICAL**: Completar antes de cualquier user story.

- [x] T001 Agregar entrada `{ label: 'Accesos', href: '/accesos', roles: ['ADMINISTRADOR'] }` a `NAV_ITEMS` y `'/accesos': ['ADMINISTRADOR']` a `ROUTE_ROLES` en `apps/web/src/lib/nav-config.ts`

**Checkpoint**: La opción "Accesos" aparece en el sidebar solo cuando el usuario logueado es ADMINISTRADOR.

---

## Phase 3: User Story 1 — Ver historial de accesos (Priority: P1) 🎯 MVP

**Goal**: Un administrador puede abrir la sección "Accesos" y ver una tabla cronológica con todos los intentos de inicio de sesión (exitosos y fallidos), incluyendo usuario, fecha/hora, IP y resultado.

**Independent Test**: Iniciar sesión con cualquier usuario, luego entrar como ADMINISTRADOR a `/accesos` y verificar que el acceso recién registrado aparece en la tabla con los datos correctos.

### Implementation

- [x] T002 [P] [US1] Crear `apps/web/src/app/api/accesos/route.ts` — GET endpoint que consulta `registros_auditoria` filtrando `accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')`, hace JOIN a `usuarios`, ordena por `creado_en DESC`, devuelve campos `id`, `creado_en`, `resultado` (`exitoso`/`fallido`), `ip_origen`, `descripcion`, `usuario_id`, `usuario_nombre`, `usuario_email`, con paginación `page`/`limit` (default 50). Usar `checkAdminRole` de `@/lib/auth-server`.
- [x] T003 [P] [US1] Crear `apps/web/src/components/accesos/AccesosListClient.tsx` — client component que recibe `AccesoRow[]` y `total` como props, renderiza tabla MUI con columnas: Fecha/Hora (`creado_en` formateado), Usuario (nombre + email o "—" si null), Resultado (chip `<Chip>` verde para exitoso / rojo para fallido), IP, Descripción. Incluir `TablePagination` MUI para navegar páginas haciendo llamadas a `GET /api/accesos?page=N`.
- [x] T004 [US1] Crear `apps/web/src/app/(app)/accesos/page.tsx` — server component async que (1) verifica cookie `access_token` con `verifyToken`/`isBlacklisted`, redirige a `/login?reason=expired` si inválido; (2) verifica rol ADMINISTRADOR, redirige a `/dashboard` si no aplica; (3) consulta `GET /api/accesos` con `page=1&limit=50` usando `pool` directo (igual patrón que `UsuariosPage`); (4) renderiza `<AccesosListClient>`. (Depende de T002 y T003)

**Checkpoint**: Navegar a `/accesos` como ADMINISTRADOR muestra la tabla con los accesos reales de la BD. Otros roles son redirigidos al dashboard.

---

## Phase 4: User Story 2 — Filtrar y buscar accesos (Priority: P2)

**Goal**: El administrador puede filtrar el historial por usuario, resultado (exitoso/fallido) y rango de fechas desde la misma vista.

**Independent Test**: Filtrar por resultado "Fallido" y verificar que solo aparecen intentos de login fallidos.

### Implementation

- [x] T005 [P] [US2] Crear `apps/web/src/app/api/accesos/usuarios-con-accesos/route.ts` — GET endpoint que devuelve lista simplificada `[{ id, nombre, apellido, email }]` de usuarios que tienen al menos un registro `LOGIN_EXITOSO` o `LOGIN_FALLIDO` en `registros_auditoria`. Usar `checkAdminRole`.
- [x] T006 [P] [US2] Actualizar `apps/web/src/app/api/accesos/route.ts` — agregar soporte de query params opcionales: `usuario_id` (UUID), `resultado` (`exitoso`|`fallido` → mapear a `accion`), `desde` (fecha ISO, aplicar `>= $n::date`), `hasta` (fecha ISO, aplicar `< ($n::date + interval '1 day')`). Agregar también conteo total (`SELECT COUNT(*)`) para paginación correcta con filtros.
- [x] T007 [US2] Actualizar `apps/web/src/components/accesos/AccesosListClient.tsx` — agregar barra de filtros sobre la tabla: `Autocomplete` MUI para usuario (carga desde `/api/accesos/usuarios-con-accesos`), `Select` MUI para resultado (`Todos` / `Exitoso` / `Fallido`), dos `TextField type="date"` para `desde` y `hasta`. Al cambiar cualquier filtro, llamar a `GET /api/accesos` con los params activos y resetear a `page=1`. (Depende de T005 y T006)

**Checkpoint**: Los filtros funcionan de forma acumulativa. Limpiar filtros restaura el historial completo.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verificación de seguridad y pulido de UX.

- [x] T008 Verificar que la opción "Accesos" NO aparece en sidebar para usuarios con roles SUPERVISOR, CAJERO y COLABORADOR (revisar lógica de filtrado en `apps/web/src/components/layout/AppSidebar.tsx`)
- [x] T009 Verificar que acceder directamente a `/accesos` por URL como no-ADMINISTRADOR redirige a `/dashboard` (probar con cookie válida de SUPERVISOR)
- [x] T010 Agregar estado de carga (MUI `Skeleton` o `CircularProgress`) y estado vacío ("Sin registros de acceso") en `apps/web/src/components/accesos/AccesosListClient.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 2 (Foundational)**: Sin dependencias — puede iniciar de inmediato
- **Phase 3 (US1)**: Depende de Phase 2 completada
- **Phase 4 (US2)**: Depende de Phase 3 completada (los filtros extienden la tabla de US1)
- **Phase 5 (Polish)**: Depende de Phase 4 completada

### User Story Dependencies

- **US1 (P1)**: Puede iniciar tras completar Phase 2. Sin dependencias de otras stories.
- **US2 (P2)**: Extiende US1 (modifica mismos archivos). Debe iniciar tras completar US1.

### Within Each User Story

- **US1**: T002 y T003 son paralelos → T004 depende de ambos
- **US2**: T005 y T006 son paralelos → T007 depende de ambos

---

## Parallel Opportunities

```bash
# Phase 3 (US1) — Iniciar T002 y T003 en paralelo:
Task T002: "Crear apps/web/src/app/api/accesos/route.ts"
Task T003: "Crear apps/web/src/components/accesos/AccesosListClient.tsx"
# → Luego T004 cuando ambos estén completos

# Phase 4 (US2) — Iniciar T005 y T006 en paralelo:
Task T005: "Crear apps/web/src/app/api/accesos/usuarios-con-accesos/route.ts"
Task T006: "Actualizar apps/web/src/app/api/accesos/route.ts (filtros)"
# → Luego T007 cuando ambos estén completos
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Phase 2: Agregar `/accesos` a `nav-config.ts` (T001)
2. ✅ Phase 3: API + componente + page (T002, T003, T004)
3. **STOP y VALIDAR**: Abrir `/accesos` como ADMINISTRADOR y verificar tabla con datos reales
4. Hacer deploy/demo si ya tiene valor

### Incremental Delivery

1. T001 → Sidebar listo con "Accesos" visible para ADMINISTRADOR
2. T002 + T003 (paralelos) → T004: Historial básico funcional (MVP)
3. T005 + T006 (paralelos) → T007: Filtros disponibles
4. T008–T010: Pulido de UX y seguridad

---

## Notes

- No hay cambios al modelo de datos ni al flujo de autenticación
- El page server-side (`accesos/page.tsx`) puede cargar los primeros 50 registros directamente desde la BD (sin llamada fetch) para reducir latencia en primer render — mismo patrón que `UsuariosPage`
- `[P]` = archivos distintos, sin dependencias entre ellos
- `[Story]` mapea cada tarea a su user story para trazabilidad
