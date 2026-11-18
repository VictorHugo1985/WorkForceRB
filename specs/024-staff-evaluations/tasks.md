# Tasks: Evaluaciones del Personal

**Input**: Design documents from `/specs/024-staff-evaluations/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/evaluaciones-api.md, quickstart.md

**Tests**: No solicitados en la spec → sin tareas de tests automatizados. La validación es manual según `quickstart.md`.

**Organization**: Tareas agrupadas por historia de usuario para implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario (US1–US4)
- Rutas relativas a la raíz del repo; código web bajo `apps/web/src/`

## Convenciones a respetar (aplican a todas las tareas)

- Route Handlers con `pool` de `@/lib/auth-server`, `client = await pool.connect()` / `finally client.release()`, SQL parametrizado, validación con `zod` → 422 con `parsed.error.issues[0].message` (patrón de `apps/web/src/app/api/configuracion/areas/route.ts`).
- Escrituras + auditoría en una transacción (`BEGIN`/`COMMIT`/`ROLLBACK`); insertar en `registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_anteriores, datos_nuevos)` con `ip_origen = req.headers.get('x-forwarded-for')` (patrón de `apps/web/src/app/api/colaboradores/[id]/estado/route.ts`).
- Valores `NUMERIC` se devuelven como string (ej. `"25.00"`), tal como los entrega `pg`.
- UI con MUI y `useSnackbar` de `@/lib/SnackbarContext` para mensajes; textos en español.
- Códigos de error y formas de respuesta exactamente como en `contracts/evaluaciones-api.md`.

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Esquema de base de datos disponible.

- [x] T001 Ejecutar `specs/024-staff-evaluations/migration.sql` en el SQL Editor de Supabase y verificar con las consultas de `specs/024-staff-evaluations/quickstart.md` §1 (4 criterios activos, suma 100.00). *(Tarea manual del usuario: requiere acceso a Supabase.)*

---

## Phase 2: Foundational (Prerequisito bloqueante)

**Purpose**: Helpers compartidos de autorización y de dominio que usan todas las historias.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [x] T002 Agregar `export async function checkRoles(req: NextRequest, roles: string[]): Promise<{ userId: string; roles: string[] } | NextResponse>` en `apps/web/src/lib/auth-server.ts`, con la misma secuencia que `checkAdminRole` (cookie → `verifyToken` → `isBlacklisted` → rol → `checkSessionValidity`) pero respondiendo 403 `{ error: 'FORBIDDEN', required_roles: roles }` si ningún rol coincide. Reescribir `checkAdminRole` para que delegue en `checkRoles(req, ['ADMINISTRADOR'])` y devuelva `{ userId }`, manteniendo su firma y el body 403 `{ error: 'FORBIDDEN', required_role: 'ADMINISTRADOR' }` para no romper a quienes ya lo llaman.
- [x] T003 [P] Crear `apps/web/src/lib/evaluaciones.ts` (solo servidor) con: `todayGMTMinus4(): string` (YYYY-MM-DD, misma lógica que en `apps/web/src/app/api/eventos-biometricos/route.ts`); `toCentesimas(v: string|number): number` (convierte "25.00" → 2500 sin flotantes); `sumaPesos(pesos: (string|number)[]): number` en centésimas; `calcularPuntajeFinal(items: {peso: string|number; puntaje: number}[]): string` = Σ(puntaje × peso_centésimas) / 100, redondeado a 2 decimales, devuelto como string "8.60"; `configVersion(criterios: {id: string; nombre: string; peso: string}[]): string` = SHA-256 hex (`node:crypto`) de `id:nombre:peso` ordenados por `id` y unidos con `|`; y constantes `ROLES_EVALUACION = ['ADMINISTRADOR','SUPERVISOR']`, `PUNTAJE_MIN = 1`, `PUNTAJE_MAX = 10`.
- [x] T004 [P] Crear `apps/web/src/lib/evaluaciones-types.ts` (importable desde el cliente) con los tipos TS del contrato: `CriterioEvaluacion`, `CriteriosResponse`, `CriterioVigente`, `CriteriosVigentesResponse`, `ColaboradorEvaluacionRow`, `EvaluacionResumen`, `EvaluacionDetalle`, `HistorialResponse`.

**Checkpoint**: Helpers listos; las historias pueden comenzar.

---

## Phase 3: User Story 1 — Configurar criterios de evaluación ponderados (Priority: P1) 🎯 MVP

**Goal**: El ADMINISTRADOR gestiona los criterios y sus pesos desde Configuración → "Criterios de evaluación", con la suma en vivo y el estado válido/no válido.

**Independent Test**: Crear/editar criterios hasta 30/20/20/30 y ver "Configuración válida (100%)"; dejar la suma en 90% y ver el estado no válido; nombre duplicado → error (quickstart US1).

### Implementation

- [x] T005 [P] [US1] Crear `apps/web/src/app/api/configuracion/criterios-evaluacion/route.ts`: `GET` (checkAdminRole) devuelve todos los criterios ordenados por `activo DESC, nombre`, con `en_uso` (EXISTS en `evaluacion_detalles`), `suma_activos` (string 2 decimales) y `configuracion_valida` (suma = 100.00); `POST` valida `{nombre 1..100 trim, descripcion?: string|null, peso: number >0 ≤100 con ≤2 decimales}`, revisa duplicado `LOWER(nombre)` entre activos → 409 "Ya existe un criterio activo con ese nombre.", inserta y audita `CRITERIO_EVALUACION_CREADO` (entidad_tipo `CriterioEvaluacion`) en transacción → 201 `{ criterio }`.
- [x] T006 [P] [US1] Crear `apps/web/src/app/api/configuracion/criterios-evaluacion/[id]/route.ts`: `PATCH` (checkAdminRole) con body parcial `{nombre?, descripcion?, peso?, activo?}` (al menos un campo); 404 si no existe; si el resultado queda activo, revisar duplicado de nombre entre otros activos → 409; `UPDATE ... SET ..., actualizado_en = now()`; auditar `CRITERIO_EVALUACION_ACTUALIZADO` con fila previa/nueva, en transacción → 200 `{ criterio }`. No exponer DELETE (FR-007).
- [x] T007 [P] [US1] Crear `apps/web/src/app/api/configuracion/criterios-evaluacion/pesos/route.ts`: `PUT` (checkAdminRole) con body `{ pesos: [{id, peso}] }`; en transacción, bloquear los activos con `SELECT id, peso FROM criterios_evaluacion WHERE activo FOR UPDATE`; exigir que los ids coincidan exactamente con los activos (si no, 422 "Debe incluir todos los criterios activos.") y que `sumaPesos` = 10000 centésimas (si no, 422 "Los pesos deben sumar 100%."); actualizar cada peso y `actualizado_en`; auditar `CRITERIO_EVALUACION_PESOS_ACTUALIZADOS` (entidad_id NULL, previos/nuevos) → 200 con el mismo shape que el GET.
- [x] T008 [US1] Crear `apps/web/src/components/configuracion/CriteriosEvaluacionSection.tsx` (`'use client'`), siguiendo el estilo de `AreasSection.tsx`: tabla (nombre, descripción, peso %, estado, acciones editar/activar-desactivar), botón "Nuevo criterio" (diálogo nombre/descripción/peso), barra de resumen con "Suma de pesos activos: X% de 100%" + `Chip` verde "Configuración válida" o ámbar "Los pesos deben sumar 100% para registrar evaluaciones", botón "Redistribuir pesos" que abre un diálogo con un input numérico por criterio activo, suma en vivo y "Guardar" deshabilitado hasta llegar a 100 → `PUT .../pesos`. Mostrar errores 409/422 del backend en snackbar. Recargar la lista después de cada operación. Depende de T005–T007.
- [x] T009 [US1] Agregar la pestaña "Criterios de evaluación" (cuarta) en `apps/web/src/components/configuracion/ConfiguracionPage.tsx`, que renderiza `<CriteriosEvaluacionSection />` cuando `tab === 3`.

**Checkpoint**: US1 completa y validable sola (quickstart US1 pasos 1, 2, 4, 5).

---

## Phase 4: User Story 2 — Registrar una evaluación a un trabajador (Priority: P1)

**Goal**: ADMINISTRADOR/SUPERVISOR entran a "Evaluaciones", buscan un colaborador activo y registran una evaluación 1–10 por criterio; el servidor calcula el puntaje final.

**Independent Test**: Con criterios al 100%, buscar un colaborador por cédula, puntuar 8/7/9/10 (pesos 30/20/20/30) → vista previa 8.60 → guardar → 201 con puntaje 8.60; criterio vacío, fecha futura, criterios ≠100% y cambio concurrente quedan bloqueados (quickstart US2 + US1 paso 3).

### Implementation

- [x] T010 [P] [US2] Agregar la entrada `{ label: 'Evaluaciones', href: '/evaluaciones', roles: ['ADMINISTRADOR','SUPERVISOR'] }` en `NAV_ITEMS` (después de 'Colaboradores') y `'/evaluaciones': ['ADMINISTRADOR','SUPERVISOR']` en `ROUTE_ROLES`, en `apps/web/src/lib/nav-config.ts`.
- [x] T011 [P] [US2] Agregar el icono de `/evaluaciones` (`AssignmentTurnedInIcon` de `@mui/icons-material`) en el mapa de iconos de `apps/web/src/components/layout/AppSidebar.tsx`.
- [x] T012 [P] [US2] Crear `apps/web/src/app/api/evaluaciones/colaboradores/route.ts`: `GET` (`checkRoles(req, ROLES_EVALUACION)`) con query `q`, `incluir_inactivos` (default false), `page`, `limit` (default 50, máx 200); `q` filtra con ILIKE sobre `nombre`, `apellido`, `cedula` y `nombre || ' ' || apellido`; `LEFT JOIN LATERAL` (o subconsulta agregada) sobre `evaluaciones WHERE estado='VIGENTE'` para `puntaje_promedio` (ROUND(AVG,2)), `total_evaluaciones` y `ultima_evaluacion` (MAX(fecha_evaluacion)); orden `apellido, nombre`; devuelve `{ total, page, limit, colaboradores }` según el contrato.
- [x] T013 [P] [US2] Crear `apps/web/src/app/api/evaluaciones/criterios-vigentes/route.ts`: `GET` (`checkRoles` ADMIN/SUPERVISOR) devuelve los criterios activos (id, nombre, descripcion, peso) ordenados por nombre, `suma_activos`, `configuracion_valida` y `config_version` (con `configVersion` de `lib/evaluaciones.ts`).
- [x] T014 [US2] Crear `apps/web/src/app/api/evaluaciones/route.ts`: `POST` (`checkRoles` ADMIN/SUPERVISOR). Validar con zod `{colaborador_id uuid, fecha_evaluacion YYYY-MM-DD, comentario?: string ≤1000 (trim, vacío→null), config_version string, puntajes: [{criterio_id uuid, puntaje int 1..10}] min 1}`; `fecha_evaluacion > todayGMTMinus4()` → 422 "La fecha de evaluación no puede ser futura.". En transacción: colaborador (404 `COLABORADOR_NOT_FOUND`, 409 `COLABORADOR_INACTIVO` si `activo=false`); `SELECT id, nombre, peso FROM criterios_evaluacion WHERE activo FOR SHARE`; si `sumaPesos` ≠ 10000 → 409 `CRITERIOS_NO_SUMAN_100`; si `configVersion(activos)` ≠ body.config_version → 409 `CRITERIOS_CAMBIARON`; verificar que los puntajes cubran exactamente los activos sin duplicados → si falta alguno, 422 "Faltan puntajes para: <nombres>."; si sobran o se repiten, 422; calcular `puntaje_final` con `calcularPuntajeFinal`; insertar `evaluaciones` (evaluador_id = userId) y un `evaluacion_detalles` por criterio con snapshot `criterio_nombre`, `peso`; auditar `EVALUACION_REGISTRADA` (entidad_tipo `Evaluacion`, datos_nuevos = encabezado + detalles). Responder 201 `{ evaluacion: EvaluacionDetalle }`; armar el objeto con una función `fetchEvaluacionDetalle(client, id)` exportada desde `apps/web/src/lib/evaluaciones.ts` (JOIN a colaboradores, usuarios evaluador/anulador y detalles ordenados por `criterio_nombre`), que reutilizarán T018 y T021.
- [x] T015 [US2] Crear `apps/web/src/components/evaluaciones/NuevaEvaluacionDialog.tsx` (`'use client'`), con props `{ open, colaborador: {id, nombre, apellido}, onClose, onSaved }`: al abrir, `GET /api/evaluaciones/criterios-vigentes`; si `configuracion_valida=false`, mostrar `Alert` "Los criterios de evaluación no suman 100%. Un administrador debe ajustarlos en Configuración." y deshabilitar el guardado; por cada criterio, nombre, peso % y selector 1–10 (`ToggleButtonGroup` o `Select`); fecha (default hoy GMT-4, `max` = hoy); comentario opcional (multiline, 1000 caracteres máx.); vista previa del puntaje final con la misma fórmula (solo display); "Guardar" deshabilitado hasta completar todos los criterios; `POST /api/evaluaciones` con `config_version`; ante 409 `CRITERIOS_CAMBIARON`, mostrar el mensaje "Los criterios cambiaron mientras completaba la evaluación. Se recargó el formulario." y volver a cargar los criterios; otros errores en snackbar; en caso de éxito, snackbar "Evaluación registrada" + `onSaved()`.
- [x] T016 [US2] Crear `apps/web/src/components/evaluaciones/EvaluacionesListClient.tsx` (`'use client'`), con props `{ initialData, rowsPerPage }`: buscador con debounce de 300 ms (nombre o cédula), switch "Incluir inactivos", tabla paginada (colaborador "Apellido, Nombre", cédula, puntaje promedio o "—", última evaluación o "Sin evaluaciones", chip "Inactivo" si aplica), acciones "Ver histórico" (link a `/evaluaciones/[id]`) y "Nueva evaluación" (solo si `activo`) que abre `NuevaEvaluacionDialog`; en `onSaved` recargar la página actual vía `GET /api/evaluaciones/colaboradores`.
- [x] T017 [US2] Crear `apps/web/src/app/(app)/evaluaciones/page.tsx` (server component), con el mismo guard que `apps/web/src/app/(app)/accesos/page.tsx` pero permitiendo ADMINISTRADOR o SUPERVISOR (si no, redirect `/dashboard`): título "Evaluaciones", subtítulo "Evaluaciones de desempeño del personal.", carga la primera página (50 activos) con la misma consulta que T012 (extraer la consulta a una función `listarColaboradoresEvaluacion(client, {q, incluirInactivos, page, limit})` en `apps/web/src/lib/evaluaciones.ts` y usarla en T012 y aquí), y renderiza `<EvaluacionesListClient />`.

**Checkpoint**: US1 + US2 = MVP funcional (configurar y registrar).

---

## Phase 5: User Story 3 — Consultar el histórico de evaluaciones de un trabajador (Priority: P2)

**Goal**: Ver el histórico del colaborador (más reciente primero), con resumen y detalle por criterio con el snapshot.

**Independent Test**: 3 evaluaciones del mismo colaborador aparecen ordenadas, con promedio y última fecha; el detalle muestra los nombres y pesos originales después de renombrar un criterio; un colaborador inactivo muestra su histórico sin "Nueva evaluación" (quickstart US3).

### Implementation

- [x] T018 [P] [US3] Crear `apps/web/src/app/api/evaluaciones/[id]/route.ts`: `GET` (`checkRoles` ADMIN/SUPERVISOR) → `fetchEvaluacionDetalle` → 200 `{ evaluacion }` o 404 `NOT_FOUND`. Validar que `id` sea un uuid (si no, 404).
- [x] T019 [P] [US3] Crear `apps/web/src/app/api/evaluaciones/colaboradores/[colaboradorId]/route.ts`: `GET` (`checkRoles` ADMIN/SUPERVISOR) → `colaborador` (incluye inactivos; 404 `COLABORADOR_NOT_FOUND`), `resumen` (promedio, total y última fecha de las VIGENTES) y `evaluaciones` (id, fecha_evaluacion, creado_en, evaluador_nombre "Nombre Apellido", puntaje_final, estado) ordenadas por `fecha_evaluacion DESC, creado_en DESC`. Extraer la consulta a `obtenerHistorial(client, colaboradorId)` en `apps/web/src/lib/evaluaciones.ts` para reutilizarla en T022.
- [x] T020 [P] [US3] Crear `apps/web/src/components/evaluaciones/EvaluacionDetalleDialog.tsx` (`'use client'`), con props `{ evaluacionId, open, onClose, isAdmin, onChanged }`: `GET /api/evaluaciones/[id]`; muestra colaborador, fecha de evaluación, registrado el (fecha y hora), evaluador, tabla de criterio / peso % / puntaje, puntaje final destacado y comentario; si está ANULADA, `Alert` con motivo, quién la anuló y cuándo. Sin controles de edición (FR-013). Deja un espacio para el botón "Anular" (se completa en US4).
- [x] T021 [US3] Crear `apps/web/src/components/evaluaciones/HistorialClient.tsx` (`'use client'`), con props `{ initial: HistorialResponse, isAdmin }`: encabezado con el nombre y la cédula del colaborador (+ chip "Inactivo"), tarjetas de resumen (Puntaje promedio, Total vigentes, Última evaluación), botón "Nueva evaluación" (solo si está activo) que abre `NuevaEvaluacionDialog`, lista/tabla de evaluaciones (fecha, evaluador, puntaje, chip Vigente/Anulada con las anuladas atenuadas), clic en una fila → `EvaluacionDetalleDialog`; estado vacío "Este colaborador aún no tiene evaluaciones."; después de guardar o anular, recargar con `GET /api/evaluaciones/colaboradores/[id]`; link "← Volver a Evaluaciones".
- [x] T022 [US3] Crear `apps/web/src/app/(app)/evaluaciones/[colaboradorId]/page.tsx` (server component, mismo guard ADMIN/SUPERVISOR que T017): `obtenerHistorial`; si no existe → `notFound()`; renderiza `<HistorialClient initial={...} isAdmin={roles.includes('ADMINISTRADOR')} />`.

**Checkpoint**: US1–US3 operativas.

---

## Phase 6: User Story 4 — Anular una evaluación registrada por error (Priority: P3)

**Goal**: El ADMINISTRADOR anula con un motivo obligatorio; la evaluación queda visible como "Anulada" y fuera del promedio.

**Independent Test**: Anular con motivo → estado Anulada con motivo, usuario y fecha, y el promedio se recalcula; sin motivo → bloqueado; SUPERVISOR no ve el botón y el POST directo devuelve 403 (quickstart US4).

### Implementation

- [x] T023 [P] [US4] Crear `apps/web/src/app/api/evaluaciones/[id]/anular/route.ts`: `POST` (`checkAdminRole`) con body `{ motivo: string trim 1..500 }` (vacío → 422 "El motivo es obligatorio."); en transacción, `SELECT estado ... FOR UPDATE` (404 `NOT_FOUND`; si ya está ANULADA → 409 `YA_ANULADA`); `UPDATE evaluaciones SET estado='ANULADA', motivo_anulacion, anulada_por=userId, anulada_en=now()`; auditar `EVALUACION_ANULADA` (`{estado:'VIGENTE'}` → `{estado:'ANULADA', motivo}`) → 200 `{ evaluacion: fetchEvaluacionDetalle }`.
- [x] T024 [P] [US4] Crear `apps/web/src/components/evaluaciones/AnularEvaluacionDialog.tsx` (`'use client'`), con props `{ evaluacionId, open, onClose, onAnulada }`: advertencia "La anulación es irreversible. La evaluación seguirá visible en el histórico pero no contará en el promedio.", campo motivo obligatorio (500 caracteres máx.), botón "Anular" (color error) deshabilitado si el motivo está vacío → `POST /api/evaluaciones/[id]/anular`; errores en snackbar; éxito → snackbar "Evaluación anulada" + `onAnulada()`.
- [x] T025 [US4] En `apps/web/src/components/evaluaciones/EvaluacionDetalleDialog.tsx`, mostrar el botón "Anular evaluación" solo si `isAdmin && estado === 'VIGENTE'`; abre `AnularEvaluacionDialog` y, al anular, recarga el detalle y llama a `onChanged()` para que `HistorialClient` refresque la lista y el resumen.

**Checkpoint**: Las 4 historias completas.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T026 [P] Verificar que `npx tsc --noEmit` y `npm run build` en `apps/web` terminen sin errores nuevos.
- [ ] T027 Ejecutar la validación manual completa de `specs/024-staff-evaluations/quickstart.md` §3 (US1–US4, Acceso, Auditoría) y marcar en `specs/024-staff-evaluations/checklists/requirements.md` cualquier desvío encontrado.
- [ ] T028 [P] Revisar el responsive (ancho ≤ 600 px) de `EvaluacionesListClient`, `HistorialClient`, `NuevaEvaluacionDialog` (`fullScreen` en móvil vía `useMediaQuery`) y `CriteriosEvaluacionSection`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sin dependencias; es manual y bloquea cualquier prueba contra la BD.
- **Foundational (T002–T004)**: bloquea todas las historias.
- **US1 (Phase 3)**: depende de Foundational.
- **US2 (Phase 4)**: depende de Foundational. Funcionalmente necesita criterios válidos: la migración ya siembra 4 al 25%, así que **se puede desarrollar en paralelo con US1**.
- **US3 (Phase 5)**: depende de `fetchEvaluacionDetalle` (T014) y de `NuevaEvaluacionDialog` (T015) para el botón del histórico. Las rutas T018/T019 pueden empezar en cuanto exista T014.
- **US4 (Phase 6)**: depende de US3 (T020 para integrar el botón) y de `fetchEvaluacionDetalle`.
- **Polish**: al final.

### User Story Dependencies

```text
T001 ─┐
      ├─▶ Foundational (T002, T003∥T004) ─┬─▶ US1 (T005∥T006∥T007 → T008 → T009)
      │                                   └─▶ US2 (T010∥T011∥T012∥T013 → T014 → T015 → T016 → T017)
      │                                                         │
      │                                                         └─▶ US3 (T018∥T019∥T020 → T021 → T022)
      │                                                                                   │
      │                                                                                   └─▶ US4 (T023∥T024 → T025)
      └───────────────────────────────────────────────────────────────────────────────────────▶ Polish (T026–T028)
```

### Within Each User Story

- Rutas API antes que los componentes que las consumen.
- Los helpers compartidos en `lib/evaluaciones.ts` se agregan en la tarea que los usa por primera vez (T014, T017, T019); las tareas posteriores los reutilizan.

---

## Parallel Opportunities

**Foundational**: T003 y T004 en paralelo (T002 toca otro archivo y también puede ir en paralelo).

**US1**: las tres rutas a la vez:
```text
T005 configuracion/criterios-evaluacion/route.ts
T006 configuracion/criterios-evaluacion/[id]/route.ts
T007 configuracion/criterios-evaluacion/pesos/route.ts
```

**US2**: navegación + rutas de lectura a la vez:
```text
T010 nav-config.ts
T011 AppSidebar.tsx
T012 api/evaluaciones/colaboradores/route.ts
T013 api/evaluaciones/criterios-vigentes/route.ts
```

**US3**: `T018 ∥ T019 ∥ T020`. **US4**: `T023 ∥ T024`.

**Entre historias**: US1 completa y US2 completa pueden avanzar en paralelo después de Foundational.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. T001 (migración) → Foundational.
2. US1: configurar criterios → validar.
3. US2: registrar evaluaciones → validar.
4. **STOP & VALIDATE**: ya se pueden configurar criterios y registrar evaluaciones (el histórico se puede consultar en la BD mientras tanto).

### Incremental Delivery

1. MVP (US1 + US2) → deploy/demo.
2. US3 (histórico en pantalla) → deploy/demo.
3. US4 (anulación) → deploy/demo.
4. Polish.

---

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- No hay PUT/PATCH/DELETE de evaluaciones (FR-013) ni DELETE de criterios (FR-007).
- Cada escritura va con su auditoría en la misma transacción.
- Commit al cerrar cada fase.
