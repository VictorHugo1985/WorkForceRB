# Tasks: Reporte de Horas Trabajadas

**Input**: Design documents from `/specs/025-worked-hours-report/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/horas-trabajadas-api.md, quickstart.md

**Tests**: No solicitados → sin tests automatizados. Validación manual (`quickstart.md`) + script de verificación de invariantes en solo lectura (Polish).

**Organization**: Por historia de usuario.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1–US4
- Rutas relativas a la raíz; código web bajo `apps/web/src/`

## Convenciones (aplican a todas las tareas)

- **Prohibido leer tablas `liquidacion_*`** o cualquier dato de liquidaciones (FR-006). Solo se importa la función pura `buildJornadas` de `@/lib/liquidacion-db` (no modificar ese archivo).
- Route Handlers con `pool` y `checkRoles(req, ROLES_HORAS)` de `@/lib/auth-server`; `client.release()` en `finally`; SQL parametrizado; validación de query con `zod` → 422 `{ error }`.
- Páginas server con `requirePageRoles(ROLES_HORAS)` (de `@/lib/auth-server`, feature 024).
- UI con MUI (`slotProps`, `useMediaQuery`), `useSnackbar` de `@/lib/SnackbarContext`, textos en español, fechas `DD/MM/YYYY`.
- Respuestas exactamente como en `contracts/horas-trabajadas-api.md`.

---

## Phase 1: Setup

- [x] T001 Agregar `{ label: 'Horas trabajadas', href: '/horas-trabajadas', roles: ['ADMINISTRADOR','SUPERVISOR'] }` en `NAV_ITEMS` (después de 'Eventos Biométricos') y `'/horas-trabajadas': ['ADMINISTRADOR','SUPERVISOR']` en `ROUTE_ROLES` de `apps/web/src/lib/nav-config.ts`.
- [x] T002 [P] Agregar el icono `'/horas-trabajadas': <ScheduleIcon fontSize="small" />` (import `@mui/icons-material/Schedule`) al mapa `NAV_ICONS` de `apps/web/src/components/layout/AppSidebar.tsx`.

---

## Phase 2: Foundational (bloqueante)

**Purpose**: Motor de cálculo compartido por todas las historias.

- [x] T003 [P] Crear `apps/web/src/lib/horas-trabajadas-types.ts` (importable en el cliente) con los tipos del contrato: `Periodo = 'trimestre'|'semestre'|'anio'`, `Agrupacion = 'mes'|'semana'`, `Tramo`, `Celda {horas:number; incompletos:number}`, `FilaColaborador`, `ReporteHorasResponse`, `DiaDetalle`, `DetalleHorasResponse`; y los helpers `formatHoras(n): string` (1 decimal, ej. "42.5"), `formatFecha(iso): string` (DD/MM/YYYY), y las constantes `PERIODO_LABEL` ("Último trimestre"/"Último semestre"/"Último año") y `MESES_CORTOS` (Ene…Dic).
- [x] T004 Crear `apps/web/src/lib/horas-trabajadas.ts` (solo servidor) con:
  - `ROLES_HORAS = ['ADMINISTRADOR','SUPERVISOR']`; `todayGMTMinus4()` (`new Date(Date.now() - 4h).toISOString().slice(0,10)`); helpers de fechas en UTC puro sobre strings `YYYY-MM-DD` (`addDays`, `isoWeekMonday`, `isoWeekKey` → `YYYY-Www`).
  - `calcularPeriodo(periodo, hoy) → { desde, hasta }`: `desde` = día 1 del mes `hoy − (2|5|11)` meses; `hasta = hoy` (research R4).
  - `construirTramos(agrupacion, desde, hasta, primeraMarcacion|null) → Tramo[]`: meses calendario o semanas ISO lunes–domingo, **recortados a [desde, hasta]**; `etiqueta` mes "Nov 2026" / semana "03/11 – 09/11" (con el rango recortado); `parcial` si el tramo natural termina después de `hasta`; `sin_datos` si `primeraMarcacion` es null o `tramo.hasta < primeraMarcacion`.
  - `fetchMarcacionesLote(client, desde, hasta, colaboradorId?) → Map<colaboradorId, Map<fecha, PunchEntry[]>>`: una consulta `SELECT cc.colaborador_id, (ebd.checktime + make_interval(hours => ebd.utc_offset)) AS checktime_local, ((ebd.checktime + make_interval(hours => ebd.utc_offset))::date)::text AS fecha_local, COALESCE(ebd.tipo_evento::text,'ENTRADA') AS tipo FROM eventos_biometricos_desglosados ebd JOIN codigos_colaborador cc ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true WHERE ebd.checktime >= ($desde::date - 1)::timestamptz AND ebd.checktime < ($hasta::date + 2)::timestamptz [AND cc.colaborador_id = $x] ORDER BY cc.colaborador_id, ebd.checktime`; agrupa por colaborador y fecha local; luego aplica el **cruce de medianoche** idéntico a `fetchPunchMap` (día con cantidad impar cuya última es ENTRADA + primera del día siguiente es SALIDA con gap ≤ 12 h → se mueve); finalmente descarta fechas fuera de `[desde, hasta]`. `PunchEntry` se importa como tipo de `@/lib/liquidacion-db`.
  - `calcularJornadas(punchesPorFecha) → Map<fecha, { horas, incompleta, primeraEntrada, ultimaSalida, pares, marcacionSuelta }>` usando `buildJornadas(punches, [])` de `@/lib/liquidacion-db` (`horas = horasParejadas`, `incompleta = tieneInconsistencia`).
  - `obtenerPrimeraMarcacion(client) → string|null` = `SELECT ((MIN(checktime) + make_interval(hours => -4))::date)::text FROM eventos_biometricos_desglosados`.
  - **Sin ninguna referencia a tablas `liquidacion_*`.**

**Checkpoint**: Motor listo.

---

## Phase 3: User Story 1 — Vista general de horas por mes (Priority: P1) 🎯 MVP

**Goal**: Tabla colaboradores × meses del período elegido, con total, ⚠ de días incompletos, parcial y "sin datos".

**Independent Test**: "Último trimestre" → 3 meses + Total, noviembre parcial; "Último año" → meses previos a jun 2026 "sin datos"; un colaborador sin marcaciones en un mes → 0.0 h (quickstart US1).

### Implementation

- [x] T005 [US1] Agregar a `apps/web/src/lib/horas-trabajadas.ts` la función `generarReporte(client, periodo, agrupacion) → ReporteHorasResponse`: `hoy`, `calcularPeriodo`, `obtenerPrimeraMarcacion`, `construirTramos`, `fetchMarcacionesLote`, `calcularJornadas` por colaborador; consulta de colaboradores `SELECT c.id, c.nombre, c.apellido, c.cedula, c.activo, c.area_id, a.nombre AS area_nombre FROM colaboradores c LEFT JOIN areas a ON a.id = c.area_id ORDER BY c.apellido, c.nombre`; incluir activos siempre e inactivos solo si su total > 0; por cada tramo, `celda.horas` = Σ horas de las jornadas con fecha en `[tramo.desde, tramo.hasta]` redondeado a 2 decimales y `celda.incompletos` = cantidad de jornadas incompletas; `total_horas` = Σ celdas, `total_incompletos`; `areas` = áreas activas (`SELECT id, nombre FROM areas WHERE activo ORDER BY nombre`) más las usadas por las filas.
- [x] T006 [US1] Crear `apps/web/src/app/api/horas-trabajadas/route.ts`: `GET` con `checkRoles(req, ROLES_HORAS)`; validar `periodo` (default `trimestre`) y `agrupacion` (default `mes`) con zod (valor inválido → 422 "Período inválido." / "Agrupación inválida."); responder `generarReporte(...)`.
- [x] T007 [US1] Crear `apps/web/src/components/horas-trabajadas/HorasTrabajadasClient.tsx` (`'use client'`), con props `{ initial: ReporteHorasResponse }`: barra con `ToggleButtonGroup` de período (Último trimestre / semestre / año) y de agrupación (Por mes / Por semana); al cambiar, `GET /api/horas-trabajadas?periodo&agrupacion` con `LinearProgress` y manejo de 401 (logout + `/login?reason=expired`); subtítulo con el rango "Del DD/MM/YYYY al DD/MM/YYYY"; tabla MUI `size="small"` dentro de `TableContainer` con scroll horizontal y **primera columna fija** (`position: sticky; left: 0`), con encabezados = etiquetas de tramo (chip "parcial" en los parciales), columna "Total" en negrita; celda = `formatHoras(horas)` + si `incompletos > 0` un `Tooltip` "N días con marcaciones incompletas" con `WarningAmberIcon` color warning y el número; celdas `sin_datos` = texto gris "sin datos"; fila colaborador "Apellido, Nombre" + área en caption; estado vacío "No hay colaboradores para mostrar.".
- [x] T008 [US1] Crear `apps/web/src/app/(app)/horas-trabajadas/page.tsx` (server): `await requirePageRoles(ROLES_HORAS)`; `generarReporte(client, 'trimestre', 'mes')` con `pool.connect()`/`release`; título "Horas trabajadas", subtítulo "Horas trabajadas según las marcaciones del reloj biométrico."; renderiza `<HorasTrabajadasClient initial={...} />`.

**Checkpoint**: MVP: vista mensual funcional.

---

## Phase 4: User Story 2 — Vista por semanas (Priority: P1)

**Goal**: Agrupación semanal lunes a domingo, recortada al período, con totales idénticos a la vista mensual.

**Independent Test**: "Por semana" en el trimestre → ~12 columnas con rango; el Total de 3 colaboradores coincide con "Por mes" (quickstart US2).

### Implementation

- [x] T009 [US2] Verificar y completar en `apps/web/src/lib/horas-trabajadas.ts` la rama `agrupacion = 'semana'` de `construirTramos`: primera semana desde `desde` (aunque no sea lunes), semanas lunes a domingo, última hasta `hasta`; `key` `YYYY-Www` ISO; etiquetas "DD/MM – DD/MM" con el rango recortado; `parcial` solo en la semana que contiene a `hoy` si termina después de hoy.
- [x] T010 [US2] En `apps/web/src/components/horas-trabajadas/HorasTrabajadasClient.tsx`, para `agrupacion = 'semana'`: encabezados en dos líneas (rango arriba y "Sem NN" en caption), ancho mínimo por columna de 72 px; recordar la agrupación y el período elegidos en `localStorage` (try/catch) y aplicarlos al montar si difieren de los iniciales.

**Checkpoint**: US1 + US2 = pedido completo.

---

## Phase 5: User Story 3 — Filtrar y ordenar (Priority: P2)

**Goal**: Búsqueda, filtro por área, inactivos, orden por total y filas de totales/promedio.

**Independent Test**: Filtrar un área → solo sus colaboradores y las filas Total/Promedio se recalculan; ordenar por total; buscar por cédula; incluir inactivos (quickstart US3).

### Implementation

- [x] T011 [US3] En `apps/web/src/components/horas-trabajadas/HorasTrabajadasClient.tsx` agregar, todo en el cliente con `useMemo`: búsqueda (nombre, apellido, "nombre apellido" o cédula, sin distinguir mayúsculas ni acentos vía `normalize('NFD')`), `Select` de área ("Todas las áreas" + `initial.areas`, más "Sin área"), `Switch` "Incluir inactivos" (por defecto off; filtra `activo === false`), orden con `TableSortLabel` en "Colaborador" (apellido, nombre) y "Total" (asc/desc).
- [x] T012 [US3] En el mismo componente, agregar en `TableFooter` dos filas sobre los colaboradores **filtrados**: "Total" (Σ horas por columna y total general) y "Promedio por colaborador" (Σ / cantidad de filas visibles, 1 decimal); en columnas `sin_datos` mostrar "—"; además un contador "N colaboradores" junto a los filtros.

**Checkpoint**: US1–US3 operativas.

---

## Phase 6: User Story 4 — Detalle diario de un colaborador (Priority: P3)

**Goal**: Desde una celda, ver el detalle por día que explica el total y los días incompletos.

**Independent Test**: La suma del detalle = valor de la celda; una celda "⚠2" muestra 2 días incompletos con su marcación suelta (quickstart US4).

### Implementation

- [x] T013 [P] [US4] Crear `apps/web/src/app/api/horas-trabajadas/detalle/route.ts`: `GET` con `checkRoles(req, ROLES_HORAS)`; zod: `colaborador_id` uuid, `desde`/`hasta` `YYYY-MM-DD`, `desde ≤ hasta ≤ todayGMTMinus4()`, rango ≤ 31 días (422 con mensaje claro); colaborador inexistente → 404 `COLABORADOR_NOT_FOUND`; usar `fetchMarcacionesLote(client, desde, hasta, colaboradorId)` + `calcularJornadas`; responder `{ colaborador, desde, hasta, total_horas, dias[] }` según el contrato (solo días con marcaciones, ordenados por fecha; `pares` con entrada/salida `HH:MM` y horas; `marcacion_suelta` = hora de la marcación sin pareja o null).
- [x] T014 [P] [US4] Crear `apps/web/src/components/horas-trabajadas/DetalleHorasDialog.tsx` (`'use client'`), con props `{ open, onClose, colaborador: {id, nombre, apellido} | null, tramo: Tramo | null }`: al abrir, `GET /api/horas-trabajadas/detalle?colaborador_id&desde&hasta`; título "Apellido, Nombre" + rango del tramo; tabla Fecha (con día de la semana abreviado), Entrada, Salida, Horas, Estado (chip "Incompleto" warning con tooltip "Marcación sin pareja: HH:MM" / "OK"); filas expandibles o texto secundario con los pares (`07:58–12:01 · 13:00–17:02`); pie "Total: X h"; estado vacío "Sin marcaciones en este período."; `fullScreen` en móvil.
- [x] T015 [US4] En `apps/web/src/components/horas-trabajadas/HorasTrabajadasClient.tsx`, hacer clickeables las celdas con horas > 0 o incompletos > 0 (cursor pointer, hover) y abrir `DetalleHorasDialog` con el colaborador y el tramo; las celdas `sin_datos` no son clickeables.

**Checkpoint**: Las 4 historias completas.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T016 [P] Verificar que `npx tsc --noEmit` y `npm run build` en `apps/web` pasen sin errores.
- [x] T017 Ejecutar un script de verificación en **solo lectura** (en el scratchpad, sin escrituras en la BD) que, usando `generarReporte` y la ruta de detalle sobre datos reales, compruebe: (a) para cada colaborador, total por mes = total por semana para trimestre, semestre y año (SC-004); (b) para una muestra de 20 celdas, Σ horas del detalle = celda (SC-003); (c) tiempo de `generarReporte('anio','semana')` < 5 s (SC-002); (d) `grep -rn "liquidacion_" apps/web/src/lib/horas-trabajadas.ts apps/web/src/app/api/horas-trabajadas` sin resultados.
- [ ] T018 Validación manual completa de `specs/025-worked-hours-report/quickstart.md` en el navegador, incluida la vista móvil (≤ 600 px: columna fija, scroll horizontal, diálogo a pantalla completa).

---

## Dependencies & Execution Order

```text
Setup (T001 ∥ T002) ─┐
Foundational (T003 ∥ T004) ─┴─▶ US1 (T005 → T006, T008 ; T007 → T008)
                                   │
                                   ├─▶ US2 (T009 → T010)
                                   ├─▶ US3 (T011 → T012)
                                   └─▶ US4 (T013 ∥ T014 → T015)
                                                       └─▶ Polish (T016–T018)
```

- **Foundational** bloquea todo. `T004` usa los tipos de `T003` (se puede escribir en paralelo y ajustar los imports).
- **US1** es la base de la UI (`HorasTrabajadasClient`); US2, US3 y US4 modifican ese mismo archivo → **secuenciales entre sí** en su parte de UI.
- **US4**: `T013` y `T014` son archivos nuevos e independientes → paralelos; `T015` integra.

## Parallel Opportunities

- `T001 ∥ T002`, `T003 ∥ T004`.
- `T013 ∥ T014` (API de detalle y diálogo), incluso mientras se hace US2/US3.
- `T009` (lib) en paralelo con `T011` (componente).

## Implementation Strategy

### MVP (US1)
Setup → Foundational → US1 → validar la vista mensual.

### Incremental
1. US1 (mes) → demo.
2. US2 (semana) → cubre el pedido completo.
3. US3 (filtros y totales) → demo.
4. US4 (detalle) → demo.
5. Polish (verificación de invariantes + build + manual).

## Notes

- Ninguna tarea escribe en la BD ni requiere migración.
- No modificar `apps/web/src/lib/liquidacion-db.ts`; solo importar `buildJornadas` y el tipo `PunchEntry`.
- Commit al cerrar cada fase.
