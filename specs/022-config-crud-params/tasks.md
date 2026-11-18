# Tasks: Gestión de Parámetros de Configuración

**Input**: Design documents from `specs/022-config-crud-params/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/configuracion-api.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1=Áreas, US2=TiposAjuste, US3=TiposPeriodoPago)

---

## Phase 1: Setup

**Purpose**: Rama y estructura de directorios

- [X] T001 Create git branch `022-config-crud-params` from main: `git checkout main && git pull && git checkout -b 022-config-crud-params`
- [X] T002 [P] Create directory `apps/web/src/app/api/configuracion/areas/[id]/` (nested route for area PATCH/DELETE)
- [X] T003 [P] Create directory `apps/web/src/app/api/configuracion/tipos-ajuste/[id]/` (nested route for tipo-ajuste PATCH/DELETE)
- [X] T004 [P] Create directory `apps/web/src/app/api/configuracion/tipos-periodo-pago/[codigo]/` (nested route for periodo PATCH)
- [X] T005 [P] Create directory `apps/web/src/components/configuracion/` (client components for config page)

---

## Phase 2: Foundational (DB Migrations — Blocking)

**Purpose**: Cambios de schema en Supabase. DEBEN ejecutarse antes de cualquier código de API.

**⚠️ CRITICAL**: Ejecutar en Supabase SQL Editor antes de implementar API routes.

- [X] T006 Execute SQL migration in Supabase to create `tipos_ajuste` table (see research.md Decision 2): `CREATE TABLE tipos_ajuste (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nombre TEXT UNIQUE NOT NULL, activo BOOLEAN NOT NULL DEFAULT true, creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()); INSERT INTO tipos_ajuste (nombre) VALUES ('Bono por Horas Extras'), ('Bono por Transporte'), ('Estipendio'), ('Descuento');`
- [X] T007 Execute SQL migration in Supabase to create `tipos_periodo_pago` table (see research.md Decision 3): `CREATE TABLE tipos_periodo_pago (codigo VARCHAR(20) PRIMARY KEY, nombre TEXT NOT NULL, activo BOOLEAN NOT NULL DEFAULT true); INSERT INTO tipos_periodo_pago (codigo, nombre) VALUES ('SEMANAL', 'Semanal'), ('QUINCENAL', 'Quincenal'), ('MENSUAL', 'Mensual');`
- [X] T008 Execute SQL migration in Supabase to add `ajuste_tipo_id` column to `liquidacion_jornada` to `liquidacion_jornada` (see research.md Decision 2): `ALTER TABLE liquidacion_jornada ADD COLUMN ajuste_tipo_id UUID REFERENCES tipos_ajuste(id) ON DELETE SET NULL;`
- [X] T009 Execute SQL to migrate the 1 existing `liquidacion_jornada` record with `ajuste_tipo IS NOT NULL` to use `ajuste_tipo_id` with `ajuste_tipo IS NOT NULL` to use `ajuste_tipo_id`: `UPDATE liquidacion_jornada SET ajuste_tipo_id = (SELECT id FROM tipos_ajuste WHERE nombre = CASE ajuste_tipo WHEN 'BONO_HORAS_EXTRAS' THEN 'Bono por Horas Extras' WHEN 'BONO_TRANSPORTE' THEN 'Bono por Transporte' WHEN 'ESTIPENDIO' THEN 'Estipendio' WHEN 'DESCUENTO' THEN 'Descuento' END) WHERE ajuste_tipo IS NOT NULL;`

**Checkpoint**: Verificar en Supabase que las 3 tablas existen y `tipos_ajuste` tiene 4 filas, `tipos_periodo_pago` tiene 3 filas, `liquidacion_jornada` tiene columna `ajuste_tipo_id`.

---

## Phase 3: User Story 1 — Administrar Áreas (P1) 🎯 MVP

**Goal**: CRUD completo de áreas en `/configuracion`, con guards de colaboradores y último activo.

**Independent Test**: Crear área "Logística", verificar que aparece en la lista, renombrarla a "Logística y Despacho", inactivarla, verificar que no aparece en selector de colaboradores (GET /api/areas), y que la inactivación fue exitosa. Intentar eliminarla con colaboradores asignados → debe rechazarse.

### Implementation for User Story 1

- [X] T010 [US1] Create `GET /api/configuracion/areas` (all areas incl. inactive) and `POST /api/configuracion/areas` (create with unique name guard, 409 on duplicate, 422 on empty) in `apps/web/src/app/api/configuracion/areas/route.ts`. Use `checkAdminRole`, pool from `apps/web/src/lib/db.ts`. GET: `SELECT id, nombre, activo, creado_en FROM areas ORDER BY nombre`. POST: validate `nombre` non-empty trim, insert, return 201 with created area.
- [X] T011 [US1] Create `PATCH /api/configuracion/areas/[id]` and `DELETE /api/configuracion/areas/[id]` in `apps/web/src/app/api/configuracion/areas/[id]/route.ts`. PATCH: update `nombre` and/or `activo`; guard 422 if setting `activo=false` and `COUNT(*) WHERE activo=true AND id != $1 = 0`; guard 409 on nombre conflict. DELETE: guard 422 if `COUNT(*) FROM colaboradores WHERE area_id = $1 > 0` with message "No se puede eliminar el área porque tiene colaboradores asignados. Puedes inactivarla en su lugar."; otherwise `DELETE FROM areas WHERE id = $1` and return 204.
- [X] T012 [US1] Create `AreasSection` client component in `apps/web/src/components/configuracion/AreasSection.tsx`. State: list of areas, dialog open (create/edit), deleting state, snackbar via `useSnackbar`. UI: MUI Table with columns Nombre/Estado(Chip)/Acciones, "Nueva área" button (top right), inline edit pencil icon, toggle activo switch/button, delete icon (trash). Create/Edit via Dialog with single TextField "Nombre". On success: refetch list. Error display via Alert in dialog or snackbar. Show 422 error messages from API verbatim.
- [X] T013 [US1] Replace `<ComingSoon />` in `apps/web/src/app/(app)/configuracion/page.tsx` with a server component that renders `<ConfiguracionPage />`. Create `apps/web/src/components/configuracion/ConfiguracionPage.tsx` as client component with MUI `Tabs` + `Tab` for 3 sections (Áreas, Tipos de Ajuste, Tipos de Período de Pago). Default tab: 0 (Áreas). Initially render only `<AreasSection />` in tab 0; tabs 1 and 2 show placeholder text until US2/US3 complete.

**Checkpoint**: La página `/configuracion` muestra la pestaña "Áreas" con tabla funcional. CRUD completo opera sin errores de TypeScript.

---

## Phase 4: User Story 2 — Administrar Tipos de Ajuste (P2)

**Goal**: CRUD completo de tipos de ajuste, con guards de uso en liquidaciones y último activo.

**Independent Test**: Crear "Bono de Alimentación", verificar que aparece en el catálogo con estado Activo. Renombrarlo a "Bono Alimentario". Intentar eliminar "Bono por Horas Extras" (que tiene registros históricos en `liquidacion_jornada`) → debe rechazarse. Inactivar "Bono Alimentario" → debe desaparecer del catálogo de activos.

### Implementation for User Story 2

- [X] T014 [US2] Create `GET /api/configuracion/tipos-ajuste` and `POST /api/configuracion/tipos-ajuste` in `apps/web/src/app/api/configuracion/tipos-ajuste/route.ts`. GET: `SELECT id, nombre, activo, creado_en FROM tipos_ajuste ORDER BY nombre`. POST: validate nombre, insert, return 201. Guard 409 on nombre duplicado. All routes require `checkAdminRole`.
- [X] T015 [US2] Create `PATCH /api/configuracion/tipos-ajuste/[id]` and `DELETE /api/configuracion/tipos-ajuste/[id]` in `apps/web/src/app/api/configuracion/tipos-ajuste/[id]/route.ts`. PATCH: update nombre/activo with same guards as areas (last-active 422, nombre conflict 409). DELETE: guard 422 if `COUNT(*) FROM liquidacion_jornada WHERE ajuste_tipo_id = $1 > 0`; message: "No se puede eliminar porque está siendo usado en registros de liquidación."; otherwise delete and return 204.
- [X] T016 [US2] Create `TiposAjusteSection` client component in `apps/web/src/components/configuracion/TiposAjusteSection.tsx`. Same UI pattern as `AreasSection`: table with Nombre/Estado/Acciones, Dialog para crear/renombrar, toggle activo, delete con confirmación. Show API 422 error messages verbatim.
- [X] T017 [US2] Add `TiposAjusteSection` to tab 1 in `apps/web/src/components/configuracion/ConfiguracionPage.tsx`, replacing the placeholder text.

**Checkpoint**: Pestaña "Tipos de Ajuste" funcional. Crear, renombrar, inactivar y rechazar eliminación de tipos en uso.

---

## Phase 5: User Story 3 — Administrar Tipos de Período de Pago (P3)

**Goal**: Visualización y toggle activo/inactivo de los 3 tipos de período de pago (sin crear ni eliminar).

**Independent Test**: Inactivar "Mensual" → verificar que su chip cambia a inactivo. Intentar inactivar el último tipo activo → debe rechazarse con mensaje. Reactivar "Mensual" → chip vuelve a activo.

### Implementation for User Story 3

- [X] T018 [US3] Create `GET /api/configuracion/tipos-periodo-pago` in `apps/web/src/app/api/configuracion/tipos-periodo-pago/route.ts`. Query: `SELECT codigo, nombre, activo FROM tipos_periodo_pago ORDER BY codigo`. Requires `checkAdminRole`.
- [X] T019 [US3] Create `PATCH /api/configuracion/tipos-periodo-pago/[codigo]` in `apps/web/src/app/api/configuracion/tipos-periodo-pago/[codigo]/route.ts`. Only `activo` field accepted. Guard 422 if setting `activo=false` and `COUNT(*) FROM tipos_periodo_pago WHERE activo=true AND codigo != $1 = 0`. Return updated row.
- [X] T020 [US3] Create `TiposPeriodoPagoSection` client component in `apps/web/src/components/configuracion/TiposPeriodoPagoSection.tsx`. UI: simple table with Nombre/Estado(Chip)/Acciones. No create/delete buttons. Solo toggle activo (switch o botón). Show 422 error via Snackbar. No Dialog needed (no create).
- [X] T021 [US3] Add `TiposPeriodoPagoSection` to tab 2 in `apps/web/src/components/configuracion/ConfiguracionPage.tsx`, replacing the placeholder text.

**Checkpoint**: Las 3 pestañas están operativas. Toggle de activo/inactivo funciona con guards correctos.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: TypeScript check y validación manual completa.

- [X] T022 [P] Run TypeScript check in `apps/web`: `cd apps/web && npx tsc --noEmit` — fix any type errors before marking complete
- [ ] T023 Verify regression: `GET /api/areas` (existing dropdown route) still returns only active areas — no code change expected, just confirm the endpoint still works correctly in browser DevTools
- [ ] T024 Manual browser test: navigate to `/configuracion`, exercise all 3 tabs with create/edit/toggle/delete flows, verify error states (duplicate nombre, last-active guard, delete-with-references guard) display correct messages

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run immediately
- **Foundational (Phase 2)**: Depends on Setup; BLOCKS all user story API routes (table must exist before queries)
- **US1 — Áreas (Phase 3)**: Depends on Foundational completion; independent of US2/US3
- **US2 — Tipos Ajuste (Phase 4)**: Depends on Foundational (T006, T008, T009); independent of US1/US3 (different tables/files)
- **US3 — Tipos Período (Phase 5)**: Depends on Foundational (T007); independent of US1/US2
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1**: No inter-story dependencies. Uses existing `areas` table.
- **US2**: Requires T006 (tipos_ajuste table), T008 (ajuste_tipo_id column), T009 (data migration). No dependency on US1.
- **US3**: Requires T007 (tipos_periodo_pago table). No dependency on US1/US2.
- **ConfiguracionPage tabs**: T013 (shell) → T017 (add US2 tab) → T021 (add US3 tab). Sequential.

### Within Each User Story

- API routes (T010/T011, T014/T015, T018/T019) → Components (T012, T016, T020) → Page integration (T013→T017→T021)
- GET/POST route and PATCH/DELETE route for same entity can be written in parallel (different files)

### Parallel Opportunities

- T002, T003, T004, T005 — Setup dirs (parallel)
- T006, T007 — Both table creations (parallel, different tables)
- T008, T009 — After T006 (sequential: column then data)
- T010 and T014 — GET/POST for areas vs tipos-ajuste (parallel, different files)
- T011 and T015 — PATCH/DELETE for areas vs tipos-ajuste (parallel, different files)
- T018 and T019 — After T007 (parallel: different files)
- T012, T016, T020 — Components (parallel once their APIs exist)
- T022 and T023 — Polish checks (parallel)

---

## Parallel Example: Phase 3 (US1 — Áreas)

```bash
# Can run in parallel:
Task T010: GET + POST /api/configuracion/areas route
Task T011: PATCH + DELETE /api/configuracion/areas/[id] route

# After T010 + T011 complete:
Task T012: AreasSection component
Task T013: ConfiguracionPage shell + /configuracion page
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational migrations in Supabase (T006–T009)
3. Complete Phase 3: US1 Áreas (T010–T013)
4. **STOP and VALIDATE**: `/configuracion` muestra Áreas funcional
5. Proceed to US2, US3 if MVP validates

### Incremental Delivery

1. Setup + Migrations → DB ready
2. US1 Áreas → `/configuracion` con pestaña Áreas operativa (MVP)
3. US2 Tipos Ajuste → segunda pestaña funcional
4. US3 Tipos Período → tercera pestaña funcional
5. Polish → TypeScript clean, regresiones verificadas

---

## Notes

- Todas las rutas API están bajo `/api/configuracion/` (NO modificar `/api/areas/` existente)
- `checkAdminRole` de `apps/web/src/lib/auth-server.ts` en cada route handler
- Pool de `apps/web/src/lib/db.ts` — siempre `client.release()` en `finally`
- MUI v9: usar `slotProps={{ input: { ... } }}` (NO `InputProps`) en TextField
- No eliminar la columna `ajuste_tipo` (enum) de `liquidacion_jornada` — se mantiene deprecated
- La ruta `/api/areas` existente (solo activas, para selector de colaboradores) no se toca
