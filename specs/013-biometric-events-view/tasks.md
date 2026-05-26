# Tasks: Visualizador de Eventos Biométricos

**Input**: `specs/013-biometric-events-view/`
**Plan**: `specs/013-biometric-events-view/plan.md`
**Estado**: Pendiente

## Format: `[ID] [P?] [Story] Description`

- **[X]**: Tarea completada
- **[P]**: Puede ejecutarse en paralelo
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Agregar la nueva sección al sistema de navegación — prerequisito para que el sidebar y el proxy reconozcan `/eventos`.

- [X] T001 Actualizar `apps/web/src/lib/nav-config.ts` — agregar `{ label: 'Eventos Biométricos', href: '/eventos', roles: ['ADMINISTRADOR', 'SUPERVISOR'] }` al array `NAV_ITEMS` (después de "Cola de Pagos") y agregar `'/eventos': ['ADMINISTRADOR', 'SUPERVISOR']` al objeto `ROUTE_ROLES`.

**Checkpoint**: ✅ Setup lista — sidebar muestra "Eventos Biométricos" para ADMINISTRADOR y SUPERVISOR; el proxy protege `/eventos` para otros roles.

---

## Phase 2: Foundational (Bloqueante para US1+US2+US3)

**Purpose**: Endpoint API con filtrado server-side — todas las US dependen de este endpoint.

- [X] T002 Crear `apps/web/src/app/api/eventos-biometricos/route.ts` — exportar `GET(req: NextRequest)`. Autenticación: verificar cookie `access_token` con `verifyToken` + `isBlacklisted`; permitir solo roles `['ADMINISTRADOR', 'SUPERVISOR']` (devolver 403 si no cumple). Query params: `fecha_desde` (string YYYY-MM-DD, default hoy), `fecha_hasta` (string YYYY-MM-DD, default hoy), `colaborador` (string, búsqueda ILIKE en nombre/cédula/workno), `tipo_evento` ('ENTRADA'|'SALIDA'|'DESCONOCIDO'), `dispositivo` (nombre exacto), `estado` ('RESUELTO'|'SIN_RESOLVER'|'DISPOSITIVO_DESCONOCIDO'), `page` (number, default 1), `page_size` (25|50|100, default 25). Convertir fechas a GMT-4: `fecha_desde` → `${fecha_desde}T00:00:00-04:00`, `fecha_hasta` → día siguiente a medianoche. Ejecutar dos queries con `pool.connect()`: (1) la query principal con JOIN (eventos_biometricos → eventos_biometricos_desglosados → colaboradores) con filtros WHERE dinámicos y `ORDER BY ebd.checktime DESC LIMIT $7 OFFSET $8`; (2) query de COUNT con los mismos filtros. Response: `{ eventos: [...], total: number, page: number, page_size: number, total_pages: number }`. Cada evento incluye: `id, checktime, tipo_evento, device_name, employee_workno, display_nombre, display_identificador, estado_resolucion` (ver data-model.md para la query completa y el CASE WHEN).

**Checkpoint**: ✅ Foundation lista — `GET /api/eventos-biometricos` responde con datos filtrados y paginados.

---

## Phase 3: User Story 1 — Listado con Filtros Básicos (Priority: P1) 🎯 MVP

**Goal**: El usuario autenticado accede a `/eventos`, ve la tabla de eventos del día actual y puede filtrar por fecha, colaborador y tipo de evento.

**Independent Test**: Iniciar sesión como ADMINISTRADOR → hacer clic en "Eventos Biométricos" en el sidebar → la vista carga con eventos del día actual. Escribir un nombre en el campo colaborador y seleccionar "Entrada" en tipo → la tabla muestra solo los eventos filtrados del colaborador de tipo Entrada.

- [X] T003 [P] [US1] Crear `apps/web/src/app/(app)/eventos/page.tsx` — Server Component (sin `'use client'`). Leer cookie `access_token` con `cookies()`, llamar `verifyToken()` y `isBlacklisted()`. Si no hay sesión, redirigir a `/login?reason=expired`. Llamar `GET /api/dispositivos` internamente (fetch con cookie) para cargar la lista de dispositivos activos; si falla o retorna 403, usar array vacío `[]`. Renderizar `<EventosClient dispositivos={dispositivos} />`.

- [X] T004 [US1] Crear `apps/web/src/app/(app)/eventos/EventosClient.tsx` como Client Component (`'use client'`). Props: `{ dispositivos: { id: string; nombre: string }[] }`. Estado interno (`useState`): `filtros` con campos `fecha_desde` (string, default = hoy en GMT-4), `fecha_hasta` (string, default = hoy), `colaborador` (string, ''), `tipo_evento` (''), `dispositivo` (''), `estado` (''), `page` (1), `page_size` (25); más `loading` (boolean), `error` (string|null), `result` (`{ eventos: any[]; total: number; total_pages: number } | null`). Helper `todayGMTMinus4()`: calcular fecha local en GMT-4 como string 'YYYY-MM-DD'. `useEffect` dependiente de filtros: construir URL con `URLSearchParams`, llamar `fetch('/api/eventos-biometricos?...')`, manejar estado loading/error/result. Render: (a) sección de filtros con MUI `Box`, `TextField type="date"` para fecha_desde/hasta, `TextField` para colaborador, `Select` para tipo_evento (opciones: Todas/ENTRADA/SALIDA/DESCONOCIDO), botón "Filtrar" que resetea page a 1 y dispara fetch; (b) si loading → texto "Cargando..."; si error → MUI `Alert severity="error"`; si result.eventos.length === 0 → mensaje "No se encontraron eventos con los filtros seleccionados"; si hay resultados → MUI `Table` con columnas: Fecha y Hora (checktime formateado DD/MM/YYYY HH:mm), Colaborador (display_nombre), Tipo (MUI `Chip` color: success=ENTRADA, warning=SALIDA, default=DESCONOCIDO), Dispositivo (device_name), Estado (MUI `Chip` color: success=RESUELTO, warning=SIN_RESOLVER, error=DISPOSITIVO_DESCONOCIDO).

**Checkpoint**: ✅ US1 completa — vista de eventos con filtros de fecha, colaborador y tipo funcional.

---

## Phase 4: User Story 2 — Paginación y Ordenamiento (Priority: P1)

**Goal**: La tabla pagina los resultados. El usuario puede navegar entre páginas y cambiar el tamaño de página.

**Independent Test**: Con más de 25 eventos en el rango seleccionado, la vista muestra controles de paginación. Al hacer clic en "Siguiente", aparecen los siguientes 25 eventos. Al cambiar el tamaño a 50, la tabla recarga con 50 eventos.

- [X] T005 [US2] Agregar paginación a `apps/web/src/app/(app)/eventos/EventosClient.tsx` — añadir MUI `TablePagination` debajo de la tabla con props: `count={result?.total ?? 0}`, `page={filtros.page - 1}` (MUI usa base 0), `onPageChange={(_, newPage) => setFiltros(f => ({ ...f, page: newPage + 1 }))}`, `rowsPerPage={filtros.page_size}`, `onRowsPerPageChange={(e) => setFiltros(f => ({ ...f, page_size: Number(e.target.value) as 25|50|100, page: 1 }))}`, `rowsPerPageOptions={[25, 50, 100]}`, `labelDisplayedRows={({ from, to, count }) => \`${from}–${to} de ${count}\`}`, `labelRowsPerPage="Registros por página:"`.

**Checkpoint**: ✅ US2 completa — paginación funcional con conteo correcto y selector de tamaño.

---

## Phase 5: User Story 3 — Filtros por Dispositivo y Estado (Priority: P2)

**Goal**: El usuario puede filtrar eventos por dispositivo y estado de resolución.

**Independent Test**: Seleccionar "Estado: Sin resolver" → la tabla muestra solo eventos SIN_RESOLVER y la columna Colaborador muestra el workno. Seleccionar un dispositivo del desplegable → solo aparecen eventos de ese dispositivo.

- [X] T006 [US3] Agregar filtros de dispositivo y estado en `apps/web/src/app/(app)/eventos/EventosClient.tsx` — añadir en la sección de filtros: (a) MUI `Select` para `dispositivo` con opciones vacía ("Todos") + un `MenuItem` por cada elemento de la prop `dispositivos` (value = nombre del dispositivo); si `dispositivos.length === 0`, mostrar el Select deshabilitado con label "Sin dispositivos"; (b) MUI `Select` para `estado` con opciones: '' (Todos), 'RESUELTO' (Resuelto), 'SIN_RESOLVER' (Sin resolver), 'DISPOSITIVO_DESCONOCIDO' (Dispositivo desconocido). Ambos filtros ya están en el estado del componente desde T004 — solo agregar los controles visuales y conectarlos al estado.

**Checkpoint**: ✅ US3 completa — filtros de dispositivo y estado funcionales.

---

## Phase 6: Polish & Verificación

**Purpose**: Verificación en producción y commit final.

- [ ] T007 Verificar los 12 escenarios del `quickstart.md` contra el endpoint en producción `https://jornalero.vercel.app` — carga inicial (ESC 1), filtro de fecha (ESC 2), filtro colaborador (ESC 3), filtro tipo (ESC 4), filtros combinados (ESC 5), paginación (ESC 6), tamaño de página (ESC 7), filtro dispositivo (ESC 8), filtro estado (ESC 9), control de acceso CAJERO (ESC 10), sin resultados (ESC 11), evento sin resolver (ESC 12).

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Phase 1 (Setup)**: Sin dependencias — ejecutar primero
- **Phase 2 (Foundational)**: Depende de Phase 1 (nav-config actualizado)
- **Phases 3, 4, 5**: Dependen de Phase 2 completa (endpoint API requerido)
- **Phase 6 (Polish)**: Depende de US1+US2+US3 completas

### Dependencias dentro de las US

- T001 → T002: nav-config antes del endpoint (referencia de roles)
- T002 ∥ T003: paralelos — archivos distintos, sin dependencia entre sí
- T002 + T003 → T004: EventosClient necesita el endpoint y el Server Component padre
- T004 → T005: paginación se agrega sobre el componente ya creado
- T005 → T006: filtros avanzados se agregan sobre el componente con paginación

### Oportunidades de paralelismo

- T002 (API route) y T003 (page.tsx) pueden ejecutarse en paralelo — archivos completamente distintos
- No hay otras oportunidades de paralelismo: T004, T005, T006 modifican el mismo archivo `EventosClient.tsx`

---

## Implementation Strategy

### Estado actual

- ✅ Phase 1: Setup — nav-config.ts
- ✅ Phase 2: Foundational — API endpoint
- ✅ Phase 3 (US1): Listado con filtros básicos
- ✅ Phase 4 (US2): Paginación
- ✅ Phase 5 (US3): Filtros avanzados
- ⬜ Phase 6: Verificación producción

### Próximos pasos recomendados (MVP)

1. T001 (nav-config)
2. T002 (API route)
3. T003 ∥ T002 (page.tsx — en paralelo con T002)
4. T004 (EventosClient base)
5. **VALIDAR**: ADMINISTRADOR ve tabla de eventos del día con filtros básicos
6. T005 (paginación)
7. T006 (filtros avanzados)
8. T007 (verificación producción)

---

## Notes

- [P] = puede ejecutarse en paralelo (archivos diferentes)
- [X] = completado y verificado
- T002 es el bloqueante más crítico — sin el endpoint, el client component no puede funcionar
- T004, T005, T006 modifican el mismo archivo `EventosClient.tsx` → ejecución SECUENCIAL obligatoria
- El estado `filtros` en EventosClient debe diseñarse desde T004 con todos los campos (fecha, colaborador, tipo, dispositivo, estado, page, page_size) aunque T005 y T006 aún no los usen — evita refactorizar el estado después
- `display_nombre`: si `colaborador_id` IS NOT NULL usar nombre del colaborador; si no, usar `employee_first_name + employee_last_name`; si el nombre capturado está vacío, usar `employee_workno`
- Timestamps en `checktime` están en GMT-4 — formatear directamente sin conversión adicional
