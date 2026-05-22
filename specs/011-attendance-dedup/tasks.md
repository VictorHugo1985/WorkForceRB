# Tasks: Control de Eventos Biométricos Duplicados

**Input**: Design documents from `specs/011-attendance-dedup/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to user story from spec.md (US1 / US2 / US3)
- Exact file paths in all task descriptions

---

## Phase 1: Setup (Estructura de Módulos)

**Purpose**: Create module and component directory scaffolding before any implementation begins.

- [ ] T001 Create DeduplicationModule scaffold in `apps/api/src/deduplication/` (module, service, spec files — empty shells)
- [ ] T002 [P] Create BiometricEventsModule scaffold in `apps/api/src/biometric-events/` (module, controller, service, spec files + `dto/` subdir)
- [ ] T003 [P] Create frontend attendance components directory `apps/web/src/components/attendance/` and attendance history route `apps/web/src/app/(app)/asistencia/[colaboradorId]/`

**Checkpoint**: Directory structure ready — implementation can begin

---

## Phase 2: Foundational (Migración de Base de Datos)

**Purpose**: Schema changes that MUST be applied before any backend service can be implemented.

**⚠️ CRÍTICO**: Ninguna tarea de US1, US2 ni US3 puede comenzar hasta completar esta fase.

- [ ] T004 Add `POTENCIAL_DUPLICADO` and `DUPLICADO` values to `EstadoResolucion` enum in `packages/database/prisma/schema.prisma`
- [ ] T005 [P] Add `TipoEvento` enum (`ENTRADA`, `SALIDA`, `DESCONOCIDO`) and column `tipo_evento TipoEvento @default(DESCONOCIDO)` to `EventoBiometricoDesglosado` model in `packages/database/prisma/schema.prisma`
- [ ] T006 [P] Add `evento_referencia_id String? @db.Uuid` and self-referential Prisma relation `DuplicadoDe` (with inverse `eventos_derivados`) to `EventoBiometrico` model in `packages/database/prisma/schema.prisma`
- [ ] T007 [P] Add `DEDUP_WINDOW_MINUTES` value to `TipoConfiguracion` enum in `packages/database/prisma/schema.prisma`
- [ ] T008 Generate and apply Prisma migration `attendance_dedup` (run `prisma migrate dev`); create `apps/api/prisma/migrations/YYYYMMDDHHMMSS_attendance_dedup/migration.sql` with the two dedup performance indexes (idx_eventos_bio_dedup on eventos_biometricos_desglosados; idx_eventos_bio_colaborador_estado on eventos_biometricos)
- [ ] T009 Add seed entry for `DEDUP_WINDOW_MINUTES` default config in `packages/database/prisma/seed.ts` (`tipo=DEDUP_WINDOW_MINUTES, clave='Ventana de deduplicación', valor=2, unidad='minutos', aplica_a=GLOBAL`)
- [ ] T010 Regenerate Prisma client (`prisma generate`) and verify new types are available in `@workforce/database`

**Checkpoint**: Base de datos lista — US1, US2, US3 pueden comenzar en paralelo

---

## Phase 3: User Story 1 — Detección y Marcado Automático (Priority: P1) 🎯 MVP

**Goal**: El sistema detecta automáticamente eventos biométricos potencialmente duplicados durante el procesamiento (webhook y CSV) y los marca con estado `POTENCIAL_DUPLICADO` para revisión. Los eventos siguen incluidos en los cálculos de horas.

**Independent Test**: Enviar dos webhooks de tipo ENTRADA para el mismo colaborador con 45 segundos de diferencia. El primero queda en `RESUELTO`; el segundo en `POTENCIAL_DUPLICADO` con `evento_referencia_id` apuntando al primero. Las horas del día incluyen ambos eventos.

### Implementation for User Story 1

- [ ] T011 [US1] Implement `DeduplicationService.checkAndMark(eventId: string): Promise<void>` in `apps/api/src/deduplication/deduplication.service.ts` — query last RESUELTO event for same colaborador_id + tipo_evento within window; if found, transition new event to POTENCIAL_DUPLICADO and set evento_referencia_id (see SQL in data-model.md)
- [ ] T012 [US1] Implement DEDUP_WINDOW_MINUTES config cache (in-memory, TTL 60s) in `DeduplicationService` reading from `ConfiguracionRegla` via Prisma in `apps/api/src/deduplication/deduplication.service.ts`
- [ ] T013 [P] [US1] Implement `tipo_evento` extraction logic from CrossChex `io` field (0=ENTRADA, 1=SALIDA, absent=DESCONOCIDO) in the existing event parsing step of `apps/api/src/biometric-events/biometric-events.service.ts`; ensure `tipo_evento` is saved on `EventoBiometricoDesglosado` creation
- [ ] T014 [US1] Wire `DeduplicationService.checkAndMark()` into the spec-001 event processing pipeline in `apps/api/src/biometric-events/biometric-events.service.ts` — call after collaborator resolution (estado_resolucion transitions to RESUELTO), before any liquidacion trigger
- [ ] T015 [US1] Update hour calculation query in payroll service `apps/api/src/payroll/payroll.service.ts` — change filter from `estado_resolucion = 'RESUELTO'` to `estado_resolucion IN ('RESUELTO', 'POTENCIAL_DUPLICADO')` so flagged events remain in calculations (FR-005)
- [ ] T016 [US1] Register `DeduplicationModule` import in `apps/api/src/app.module.ts` and in `BiometricEventsModule`
- [ ] T017 [US1] Unit tests for `DeduplicationService` in `apps/api/src/deduplication/deduplication.service.spec.ts` — cover: within-window same type detects duplicate; outside-window same type does not; different type does not detect; tipo_evento=DESCONOCIDO skips check; 3+ events in rapid succession all flag against the first; identical timestamps flag as duplicate

**Checkpoint**: US1 fully functional — pipeline detecta y marca duplicados automáticamente. Verificar con Independent Test.

---

## Phase 4: User Story 2 — Visibilidad de Potenciales Duplicados (Priority: P2)

**Goal**: El supervisor, cajero o administrador puede consultar el historial de asistencia de un colaborador filtrando por estado de evento, con los potenciales duplicados resaltados visualmente y la referencia al evento original visible.

**Independent Test**: Acceder al historial del colaborador C en la semana W. Los eventos `POTENCIAL_DUPLICADO` aparecen con chip/highlight visual amarillo y muestran la fecha/hora del evento original que referencian. El filtro "Potencial Duplicado" muestra solo esos eventos.

### Implementation for User Story 2

- [ ] T018 [P] [US2] Implement `GET /biometric-events` endpoint in `apps/api/src/biometric-events/biometric-events.controller.ts` — query params: `colaborador_id` (required), `fecha_desde`, `fecha_hasta`, `estado` (optional filter), `page`, `page_size`; include `evento_referencia` nested object when estado is POTENCIAL_DUPLICADO or DUPLICADO
- [ ] T019 [P] [US2] Implement `BiometricEventsService.findMany(filters)` in `apps/api/src/biometric-events/biometric-events.service.ts` — Prisma query with date range on `EventoBiometricoDesglosado.checktime`, estado filter, include desglose + evento_referencia; enforce team scope for SUPERVISOR role
- [ ] T020 [US2] Implement attendance history page `apps/web/src/app/(app)/asistencia/[colaboradorId]/page.tsx` — fetch events via `GET /biometric-events`, render event list with pagination; show collaborator name + date range selector
- [ ] T021 [P] [US2] Implement `DuplicateStatusChip` component in `apps/web/src/components/attendance/DuplicateStatusChip.tsx` — MUI Chip variants: "Potencial Duplicado" (warning color), "Descartado" (error color, muted), "Válido" (default/hidden)
- [ ] T022 [P] [US2] Implement `AttendanceEventRow` component in `apps/web/src/components/attendance/AttendanceEventRow.tsx` — MUI TableRow with: checktime, tipo_evento (ENTRADA/SALIDA), estado chip, dispositivo name; yellow background highlight for POTENCIAL_DUPLICADO rows; muted style for DUPLICADO rows; tooltip with evento_referencia checktime when applicable
- [ ] T023 [US2] Add event state filter bar to attendance history page in `apps/web/src/app/(app)/asistencia/[colaboradorId]/page.tsx` — MUI ToggleButtonGroup: Todos / Potencial Duplicado / Descartado; updates `estado` query param passed to API

**Checkpoint**: US2 fully functional — supervisor puede ver y filtrar potenciales duplicados. Verificar con Independent Test.

---

## Phase 5: User Story 3 — Descarte Manual de Evento Potencial Duplicado (Priority: P3)

**Goal**: El administrador, supervisor o cajero puede descartar un evento `POTENCIAL_DUPLICADO` (→ `DUPLICADO`, excluido de cálculos) o confirmarlo como válido (→ `RESUELTO`, marca eliminada). Ambas acciones requieren justificación y quedan en auditoría. El descarte dispara recálculo de horas del día.

**Independent Test**: El supervisor descarta el segundo evento ENTRADA del colaborador C. El evento pasa a `DUPLICADO`. Las horas del día se recalculan excluyendo ese evento. El supervisor confirma como válido el segundo evento ENTRADA del colaborador D. El evento vuelve a `RESUELTO` sin cambio en las horas.

### Implementation for User Story 3

- [ ] T024 [P] [US3] Implement `EventActionDto` with `justificacion: string` (IsString, MinLength 5, MaxLength 500) in `apps/api/src/biometric-events/dto/event-action.dto.ts`
- [ ] T025 [US3] Implement `BiometricEventsService.discard(id, userId, justificacion)` in `apps/api/src/biometric-events/biometric-events.service.ts` — validate estado=POTENCIAL_DUPLICADO (throw ConflictException if not); transition to DUPLICADO; write RegistroAuditoria entry (accion=`DESCARTE_DUPLICADO`, datos_anteriores, datos_nuevos with justificacion)
- [ ] T026 [US3] Implement post-discard hour recalculation in `BiometricEventsService.discard()` in `apps/api/src/biometric-events/biometric-events.service.ts` — identify affected day from EventoBiometricoDesglosado.checktime; trigger payroll day recalc for that collaborator + day; return `inconsistencyWarning: boolean` if recalc produces two consecutive entries without exit
- [ ] T027 [US3] Implement `PATCH /biometric-events/:id/discard` in `apps/api/src/biometric-events/biometric-events.controller.ts` — apply role guard (ADMINISTRADOR | SUPERVISOR | CAJERO); apply team scope guard for SUPERVISOR; call `service.discard()`; return updated event + inconsistencyWarning in response
- [ ] T028 [US3] Implement `BiometricEventsService.confirmValid(id, userId, justificacion)` in `apps/api/src/biometric-events/biometric-events.service.ts` — validate estado=POTENCIAL_DUPLICADO; transition to RESUELTO + set evento_referencia_id=null; write RegistroAuditoria entry (accion=`CONFIRMACION_VALIDO_DUPLICADO`)
- [ ] T029 [US3] Implement `PATCH /biometric-events/:id/confirm-valid` in `apps/api/src/biometric-events/biometric-events.controller.ts` — same role guard as discard; call `service.confirmValid()`; return updated event
- [ ] T030 [P] [US3] Implement `DuplicateActionModal` component in `apps/web/src/components/attendance/DuplicateActionModal.tsx` — MUI Dialog with: dynamic title (Descartar / Confirmar como válido), reference event display (checktime + tipo_evento), React Hook Form + Zod justificacion field (min 5 chars), inconsistency warning Alert (shown when API returns inconsistencyWarning=true), submit handler calling PATCH endpoint via Axios
- [ ] T031 [US3] Wire action buttons into `AttendanceEventRow` in `apps/web/src/components/attendance/AttendanceEventRow.tsx` — "Descartar" and "Confirmar como válido" buttons visible only when: row is POTENCIAL_DUPLICADO AND current user has role ADMINISTRADOR | SUPERVISOR | CAJERO (check via Zustand AuthStore from spec 010); on click, open `DuplicateActionModal`
- [ ] T032 [US3] On modal submit success, optimistically update row state in attendance history page `apps/web/src/app/(app)/asistencia/[colaboradorId]/page.tsx` — transition row to DUPLICADO or RESUELTO without full page reload; show inconsistency warning banner if API returned it

**Checkpoint**: US3 fully functional — descarte y confirmación operativos con auditoría y recálculo. Verificar con Independent Test.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Integration testing, edge cases, and cross-story validation.

- [ ] T033 [P] Integration test — pipeline completo US1: webhook → resolución colaborador → DeduplicationService.checkAndMark → evento queda POTENCIAL_DUPLICADO con evento_referencia_id correcto in `apps/api/tests/integration/attendance-dedup.test.ts`
- [ ] T034 [P] Integration test — flujo US3: PATCH /discard → evento DUPLICADO → horas del día recalculadas; PATCH /confirm-valid → evento RESUELTO → horas sin cambio in `apps/api/tests/integration/attendance-dedup.test.ts`
- [ ] T035 [P] Edge case unit tests in `apps/api/src/deduplication/deduplication.service.spec.ts` — test ya incluido en T017; verificar cobertura de: CSV event con tipo_evento=DESCONOCIDO no genera falso positivo; mismo timestamp exacto clasifica como POTENCIAL_DUPLICADO
- [ ] T036 [P] Unit tests for `DuplicateActionModal` in `apps/web/tests/unit/components/attendance/DuplicateActionModal.test.tsx` — justificación vacía bloquea submit; botones de acción visibles solo para ADMINISTRADOR/SUPERVISOR/CAJERO; warning de inconsistencia se muestra cuando API retorna inconsistencyWarning=true
- [ ] T037 [P] Unit tests for `AttendanceEventRow` in `apps/web/tests/unit/components/attendance/AttendanceEventRow.test.tsx` — fila POTENCIAL_DUPLICADO tiene highlight amarillo y botones de acción; fila DUPLICADO está atenuada sin botones; fila RESUELTO no tiene chip

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede comenzar inmediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — **BLOQUEA** todas las user stories
- **US1 (Phase 3)**: Depende de Phase 2
- **US2 (Phase 4)**: Depende de Phase 2; no depende de US1 (GET endpoint no necesita DeduplicationService)
- **US3 (Phase 5)**: Depende de Phase 2; usa `estado_resolucion` ya definido; el recálculo requiere que la query de spec 006 (T015) esté actualizada
- **Polish (Phase 6)**: Depende de US1 + US2 + US3

### User Story Dependencies

- **US1 (P1)**: Independiente post-Foundational — DeduplicationService es autocontenido
- **US2 (P2)**: Independiente post-Foundational — GET endpoint no depende de US1 para funcionar
- **US3 (P3)**: Depende de T015 (actualización de la query de cálculo de spec 006) para que el recálculo post-descarte sea correcto

### Parallel Opportunities Within Each Story

**US1**:
- T011 + T013 pueden hacerse en paralelo (DeduplicationService logic vs. tipo_evento extraction)

**US2**:
- T018 + T019 (backend) pueden hacerse en paralelo con T021 + T022 (frontend components)

**US3**:
- T024 (DTO) en paralelo con cualquier otra tarea de la fase
- T025 + T028 (service methods) pueden hacerse en paralelo
- T030 (modal component) puede hacerse en paralelo con T027 + T029 (endpoints)

---

## Parallel Example: User Story 2

```
# Backend y frontend en paralelo:
Task A: T018 — GET /biometric-events endpoint (backend)
Task B: T021 — DuplicateStatusChip component (frontend)
Task C: T022 — AttendanceEventRow component with highlight (frontend)

# Once backend ready (T019 complete):
Task: T020 — Attendance history page (frontend, integrates API)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001–T003)
2. Completar Phase 2: Foundational (T004–T010) — **bloqueante**
3. Completar Phase 3: US1 (T011–T017)
4. **STOP & VALIDATE**: Pipeline detecta y marca duplicados automáticamente. Las horas incluyen POTENCIAL_DUPLICADO.
5. Demo: Enviar dos webhooks y verificar en DB que el segundo queda en POTENCIAL_DUPLICADO.

### Incremental Delivery

1. Setup + Foundational → DB lista para todos
2. US1 → Detección automática funciona (valor de negocio: las dobles lecturas se identifican)
3. US2 → Supervisor ve los potenciales duplicados en la UI (valor de negocio: visibilidad)
4. US3 → Supervisor puede descartar (valor de negocio: cálculo de horas correcto sin duplicados)

### Parallel Team Strategy

Con múltiples desarrolladores, después de completar Phase 2:
- Dev A: US1 (DeduplicationService + pipeline)
- Dev B: US2 backend (GET /biometric-events)
- Dev C: US2 frontend (componentes de historial)
- Reunir US2 e integrar → Dev B+C continúan a US3

---

## Notes

- [P] = archivos diferentes, sin dependencias entre sí en ese momento
- Cada user story es independientemente completable y testeable
- T015 (actualización de query de spec 006) es un cambio en un módulo externo — coordinar con la persona responsable de spec 006
- La migración Prisma (T008) requiere acceso a una instancia PostgreSQL local; verificar que la base de datos de desarrollo esté disponible antes de ejecutar
- `tipo_evento` en registros CSV existentes quedará en `DESCONOCIDO` por el DEFAULT de la migración — comportamiento esperado y documentado en research.md
