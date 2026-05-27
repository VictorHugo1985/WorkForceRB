# Tasks: Gestión Completa de Colaboradores

**Feature**: `014-employee-management`
**Input**: Design documents from `specs/014-employee-management/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

---

## Phase 1: Setup

**Purpose**: Verificación inicial — no se requiere inicialización de proyecto ni dependencias nuevas.
MUI v9, React Hook Form, Zod, `pg.Pool` y `checkAdminRole` ya existen en `apps/web`.

> ✅ Sin tareas de setup — el proyecto ya está configurado.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No se requiere infraestructura adicional — auth, DB pool, routing y MUI Theme ya están
operativos desde specs 001–013.

> ✅ Sin tareas fundacionales — toda la infraestructura está disponible.

**Checkpoint**: Listo para implementar user stories.

---

## Phase 3: User Story 1 — Buscar y ver colaboradores (Priority: P1) 🎯 MVP

**Goal**: Mostrar una lista client-searchable de colaboradores accesible desde el sidebar,
con navegación al perfil individual.

**Independent Test**: Hacer clic en "Colaboradores" en el sidebar → ver tabla de colaboradores
activos → escribir en búsqueda → ver filtrado instantáneo → clic en fila → perfil del colaborador.

### Implementation

- [X] T001 [P] [US1] Añadir `export async function GET` al archivo `apps/web/src/app/api/colaboradores/route.ts` — verifica JWT con `checkAdminRole`, ejecuta `SELECT c.id, c.nombre, c.apellido, c.cedula, c.activo, a.id AS area_id, a.nombre AS area_nombre FROM colaboradores c LEFT JOIN areas a ON a.id = c.area_id ORDER BY c.apellido, c.nombre` y retorna `{ colaboradores: rows }`
- [X] T002 [P] [US1] Reescribir `apps/web/src/app/(app)/colaboradores/page.tsx` como Server Component que verifica sesión con `verifyToken` desde cookie, consulta pool directamente para lista de colaboradores (misma query que T001), e importa y renderiza `ColaboradoresListClient` pasándole el array. Usar `PageHeader` con título "Colaboradores" y acción "Nuevo colaborador" que navega a `/colaboradores/nuevo`
- [X] T003 [US1] Crear `apps/web/src/app/(app)/colaboradores/ColaboradoresListClient.tsx` como Client Component con: props `{ colaboradores: ColaboradorRow[] }`, estado `busqueda` (string) y `mostrarInactivos` (boolean), lista filtrada con `useMemo` (texto sobre nombre+apellido+cédula, booleano activo), TextField de búsqueda y Switch "Mostrar inactivos" en una fila superior, MUI Table `size="small"` con columnas Nombre completo / Cédula / Área / Estado (Chip verde "Activo" / gris "Inactivo"), cada fila clickeable navega a `/colaboradores/{id}`, mensaje "No se encontraron colaboradores con ese criterio" cuando la lista filtrada está vacía

**Checkpoint**: US1 completamente funcional — lista visible desde sidebar, búsqueda en tiempo real, navegación al perfil.

---

## Phase 4: User Story 2 — Registrar nuevo colaborador (Priority: P1)

**Goal**: Integrar el wizard de registro existente al flujo del módulo: botón desde la lista,
redirect al perfil tras creación exitosa (incluso con advertencias).

**Independent Test**: Desde la lista → clic "Nuevo colaborador" → completar wizard → confirmar
→ navegar al perfil del colaborador creado (el botón ya existe en `ColaboradoresListClient`, el wizard ya existe).

### Implementation

- [X] T004 [US2] Corregir `apps/web/src/components/colaboradores/RegistroWizard.tsx`: actualmente solo redirige a `/colaboradores/{id}` cuando `json.warnings.length === 0`; cambiar para que siempre redirija a `/colaboradores/${json.colaborador.id}` tras creación exitosa (status 201), mostrando warnings en la URL como `?warnings=1` o simplemente redirigiendo siempre — así el usuario llega al perfil incluso si hubo advertencias de tarifa/horario

**Checkpoint**: US2 funcional — wizard existente integrado, redirect correcto al perfil tras creación.

---

## Phase 5: User Story 3 — Editar datos de un colaborador (Priority: P2)

**Goal**: Edición inline de nombre, apellido, cédula, área y supervisor directamente en el perfil
del colaborador, sin navegación extra.

**Independent Test**: Abrir perfil de un colaborador → clic "Editar" → campos se vuelven editables
→ cambiar área → guardar → perfil muestra área actualizada.

### Implementation

- [X] T005 [P] [US3] Añadir `export async function PATCH` al archivo `apps/web/src/app/api/colaboradores/[id]/route.ts` — verifica JWT con `checkAdminRole`, parsea body con Zod (schema: `nombre: z.string().min(1).max(100)`, `apellido`, `cedula: z.string().min(1)`, `area_id: z.string().uuid()`, `supervisor_id: z.string().uuid().nullable().optional()`), verifica cédula duplicada con `SELECT id FROM colaboradores WHERE cedula = $1 AND id != $2 LIMIT 1` (retorna 409 DUPLICATE_CEDULA si existe), ejecuta UPDATE, registra en `registros_auditoria` con acción `COLABORADOR_EDITADO`, retorna el colaborador actualizado
- [X] T006 [US3] Modificar `apps/web/src/components/colaboradores/ColaboradorPerfil.tsx` para añadir modo edición inline: estado `isEditing` (boolean), `useForm` con Zod (mismo schema que T005), pre-poblado con datos actuales del perfil; botón "Editar" (solo visible cuando `activo=true` o siempre, fuera de modo edición); en modo edición mostrar TextFields para nombre, apellido, cédula y Selects para área (fetch `/api/areas`) y supervisor (fetch `/api/usuarios/supervisores`); botón "Guardar" llama PATCH `/api/colaboradores/{id}` y en éxito actualiza estado local del perfil con los nuevos datos + muestra Alert success + `isEditing=false`; botón "Cancelar" hace `isEditing=false` + `reset()`; manejar error 409 DUPLICATE_CEDULA mostrando Alert error en el formulario

**Checkpoint**: US3 funcional — edición inline operativa, validación cédula duplicada, audit log.

---

## Phase 6: User Story 4 — Dar de baja y reactivar (Priority: P2)

**Goal**: Baja lógica (activo=false) y reactivación desde el perfil del colaborador, con
confirmación modal antes de ejecutar.

**Independent Test**: Perfil de colaborador activo → clic "Dar de baja" → Dialog → confirmar
→ colaborador muestra "Inactivo" → no aparece en lista por defecto.

### Implementation

- [X] T007 [P] [US4] Crear `apps/web/src/app/api/colaboradores/[id]/estado/route.ts` — nuevo archivo con `export async function PATCH`: verifica JWT con `checkAdminRole`, parsea body `{ activo: z.boolean() }`, busca el colaborador actual para verificar existencia y obtener estado previo (para audit), ejecuta `UPDATE colaboradores SET activo = $1, actualizado_en = now() WHERE id = $2`, registra en `registros_auditoria` con acción `COLABORADOR_BAJA` (si `activo=false`) o `COLABORADOR_REACTIVADO` (si `activo=true`), retorna `{ colaborador: { id, activo } }`
- [X] T008 [US4] Modificar `apps/web/src/components/colaboradores/ColaboradorPerfil.tsx` para añadir: estado local `activo` sincronizado con `perfil.activo` inicial; banner/Alert "Este colaborador está inactivo" visible cuando `activo=false`; botón "Dar de baja" (color error, visible cuando `activo=true`, fuera de modo edición); botón "Reactivar" (visible cuando `activo=false`); MUI `<Dialog>` de confirmación para la baja con mensaje claro, botón "Confirmar" (color error) y "Cancelar"; on confirm: PATCH `/api/colaboradores/{id}/estado` con `{ activo: false }`, en éxito actualizar estado local `activo`; botón Reactivar: PATCH con `{ activo: true }` directamente sin dialog; actualizar Chip de estado (Activo/Inactivo) en tiempo real

**Checkpoint**: US4 funcional — baja con dialog de confirmación, reactivación, estado actualizado localmente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T009 Ejecutar los 12 escenarios de validación manual de `specs/014-employee-management/quickstart.md` en la app local. Verificar especialmente: búsqueda en tiempo real (escenario 2), cédula duplicada en edición (escenario 9), baja + verificar que desaparece de lista (escenario 10), reactivación (escenario 11)
- [X] T010 [P] Actualizar `apps/web/src/app/(app)/colaboradores/[id]/page.tsx` — el componente actual importa `ColaboradorPerfil` con `perfil={perfil}` como prop y tiene un botón "Registrar otro" que navega a `/colaboradores/nuevo`; añadir un botón "← Volver a la lista" que navega a `/colaboradores` y eliminar el botón "Registrar otro" (ese botón ya existe en la lista)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 & 2**: N/A (infraestructura ya existe)
- **Phase 3 (US1)**: Sin dependencias — puede iniciar inmediatamente
- **Phase 4 (US2)**: Sin dependencias en US1 — puede ejecutarse en paralelo con Phase 3
- **Phase 5 (US3)**: Sin dependencias en US1 o US2
- **Phase 6 (US4)**: Sin dependencias en US1, US2, US3
- **Phase 7 (Polish)**: Depende de todas las fases anteriores

### Within-Phase Task Dependencies

- **T001 y T002**: Paralelos (archivos distintos)
- **T003**: Depende de T001 + T002 (necesita que la page pase datos y que el tipo ColaboradorRow esté definido)
- **T004**: Independiente de T001–T003 (archivo distinto)
- **T005 y T007**: Paralelos (archivos distintos — route.ts vs estado/route.ts)
- **T006**: Depende de T005 (llama al endpoint PATCH que debe existir)
- **T008**: Depende de T007 (llama al endpoint estado que debe existir)
- **T009**: Depende de T001–T008 (validación end-to-end)
- **T010**: Independiente (modifica la página del perfil, no el componente ColaboradorPerfil)

### User Story Dependencies

- **US1 (P1)**: Sin dependencias — base del módulo
- **US2 (P1)**: Sin dependencias en US1 (el wizard y su ruta ya existen)
- **US3 (P2)**: Sin dependencias en US1/US2 (opera sobre perfil, que ya existe)
- **US4 (P2)**: Sin dependencias en US1/US2/US3

---

## Parallel Examples

```bash
# T001 y T002 se pueden lanzar en paralelo:
Task A: "Añadir GET handler en apps/web/src/app/api/colaboradores/route.ts"
Task B: "Reescribir apps/web/src/app/(app)/colaboradores/page.tsx como Server Component"

# T005 y T007 se pueden lanzar en paralelo:
Task A: "Añadir PATCH handler en apps/web/src/app/api/colaboradores/[id]/route.ts"
Task B: "Crear apps/web/src/app/api/colaboradores/[id]/estado/route.ts"
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Completar Phase 3 (T001 → T002 → T003)
2. Completar Phase 4 (T004)
3. **VALIDAR**: Escenarios 1–6 de quickstart.md
4. El módulo de colaboradores es navegable desde el sidebar con búsqueda y creación funcional

### Incremental Delivery

1. MVP (US1+US2) → lista funcional con creación ✅
2. Añadir US3 (T005→T006) → edición inline ✅
3. Añadir US4 (T007→T008) → baja/reactivación ✅
4. Polish (T009, T010) → validación completa ✅

---

## Notes

- `[P]` = puede ejecutarse en paralelo con otras tareas `[P]` de la misma fase
- No se requieren tests automatizados — validación via quickstart.md (12 escenarios)
- `ColaboradorPerfil.tsx` es modificado por T006 (edit) y T008 (baja): ejecutar T006 ANTES de T008 para evitar conflictos en el mismo archivo
- La query de `colaboradores/page.tsx` (T002) puede ser directa al pool (patrón de `eventos/page.tsx`) en lugar de llamada al API interno — esto evita necesitar `NEXT_PUBLIC_APP_URL`
