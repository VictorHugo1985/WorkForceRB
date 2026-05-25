# Tasks: Gestión de Liquidación Semanal

**Feature**: 006-weekly-payroll | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Input**: Design documents from `specs/006-weekly-payroll/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label — [US1], [US2], [US3]
- Exact file paths included in each task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the `LiquidacionesModule` skeleton and register it so all subsequent phases compile.

- [ ] T001 Create `LiquidacionesModule` skeleton (empty providers/exports) in `apps/api/src/liquidaciones/liquidaciones.module.ts`; import `PrismaModule` and `PassportModule`
- [ ] T002 [P] Create barrel files for subdirectories: `apps/api/src/liquidaciones/dto/index.ts`, `apps/api/src/liquidaciones/services/index.ts`
- [ ] T003 Register `LiquidacionesModule` in `apps/api/src/app.module.ts` imports array
- [ ] T004 [P] Create Zustand store skeleton with empty state shape in `apps/web/src/stores/liquidacion.store.ts` (import `create` from `zustand`; export `useLiquidacionStore`)

**Checkpoint**: `npm run build` in `apps/api` passes — LiquidacionesModule compiles. No runtime errors on startup.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core calculation engine, base service guards, and state management — MUST be complete before any user story can function end-to-end.

**⚠️ CRITICAL**: No user story endpoint can be correctly tested until this phase is complete.

- [ ] T005 Implement `LiquidacionCalculatorService.resolveTarifaEfectiva(colaboradorId, fechaDia, descuentoDia)` in `apps/api/src/liquidaciones/services/liquidacion-calculator.service.ts`: query `configuraciones_reglas` for `TARIFA_HORA` with `aplica_a = COLABORADOR` and `colaborador_id = colaboradorId` vigente in `fechaDia`; fallback to `aplica_a = GLOBAL`; if `descuentoDia.descuento_tipo = TARIFA_DIA` return `descuentoDia.descuento_valor` (overrides); returns `Decimal`
- [ ] T006 Implement `LiquidacionCalculatorService.deriveEstadoDia(dia)` in same file: returns `CON_DESCUENTO` if `descuento_tipo IS NOT NULL`; else `CON_AJUSTE_HORAS` if `horas_ajustadas_supervisor IS NOT NULL`; else `APROBADO` if explicitly flagged; else `SIN_REVISION` (per Decision 3 in research.md)
- [ ] T007 Implement `LiquidacionCalculatorService.calcularTotales(liquidacionId)` in same file: (a) load all `dias_liquidacion` for the liquidacion; (b) for each day apply FR-008 formula using `resolveTarifaEfectiva`; (c) load `bonos` for collaborator × semana; (d) compute `horas_ordinarias`, `horas_extra`, `valor_horas_ordinarias`, `valor_horas_extra`, `total_bonos`, `total_descuentos`, `total_pago`; (e) `prisma.liquidaciones_semanales.update({...totals, configuracion_reglas_ids: [...ids], calculado_en: new Date()})`; returns updated totals object
- [ ] T008 Implement `LiquidacionesService.assertEditable(liquidacionId)` in `apps/api/src/liquidaciones/liquidaciones.service.ts`: query `liquidaciones_semanales.estado`; throw `HttpException(409, "La liquidación ya fue aprobada y no puede modificarse")` if `APROBADO`
- [ ] T009 Implement `LiquidacionesService.assertScope(usuarioId, roles, colaboradorId)` in same file: if roles includes `ADMINISTRADOR` → pass; else query `colaboradores.supervisor_id`; if `supervisor_id !== usuarioId` → throw `ForbiddenException`
- [ ] T010 Implement `LiquidacionesService.findOrCreateBorrador(colaboradorId, semanaId)` in same file: `prisma.liquidaciones_semanales.upsert({ where: { colaborador_id_semana_id: ... }, create: { estado: BORRADOR, ...zeros }, update: {} })`; returns the liquidacion record
- [ ] T011 [P] Implement `AuditLiquidacionService.log(accion, entidadTipo, entidadId, datosAnteriores, datosNuevos, usuarioId, ipOrigen)` in `apps/api/src/liquidaciones/services/audit-liquidacion.service.ts`: `prisma.registros_auditoria.create({...})` with all fields from data-model.md audit section
- [ ] T012 [P] Implement full Zustand store in `apps/web/src/stores/liquidacion.store.ts`: state shape `{liquidacion, dias, bonos, totales, estado}`; actions: `setLiquidacion(data)` (initial load), `applyOptimisticDia(dia)` (immediate UI update), `reconcileDia(dia)` (from server response), `applyOptimisticTotales(totales)`, `reconcileTotales(totales)`, `setAprobado(aprobadoPor, aprobadaEn)`

**Checkpoint**: Unit test `LiquidacionCalculatorService.calcularTotales` with a seeded dataset — correct `total_pago` output. `assertEditable` throws on APROBADO liquidacion. `assertScope` passes for ADMINISTRADOR, rejects mismatched SUPERVISOR.

---

## Phase 3: User Story 1 — Revisión y Ajuste de Asistencias del Período (Priority: P1) 🎯 MVP

**Goal**: Supervisor opens a collaborator's weekly view, sees all days with calculated hours and lateness indicators, adjusts hours or applies a daily discount (TARIFA_DIA or MONTO_FIJO) for any day, and sees the total update immediately.

**Independent Test**: `GET /liquidaciones?colaborador_id=<uuid>&semana_id=<uuid>` returns 7 `dias` with `horas_calculadas` and `estado_dia = SIN_REVISION`. `PATCH /dias-liquidacion/<tuesday-id>` with `{horasAjustadasSupervisor: 7, motivoAjuste: "Atraso"}` → 200 with `dia.estadoDia = CON_AJUSTE_HORAS` and updated `totales.totalPago`. Navigate to `/liquidaciones/<semanaId>/<colaboradorId>` — DataGrid renders all days; click "Ajustar" → dialog opens; submit adjustment → summary card updates optimistically.

### Implementation for User Story 1

- [ ] T013 [US1] Implement `LiquidacionesService.getLiquidacion(colaboradorId, semanaId)` in `apps/api/src/liquidaciones/liquidaciones.service.ts`: `prisma.liquidaciones_semanales.findFirst({ where: {...}, include: { dias_liquidacion: {orderBy: {fecha: 'asc'}}, bonos: {orderBy: {fecha_dia: 'asc'}} } })`; throw `NotFoundException` if not found
- [ ] T014 [P] [US1] Create `LiquidacionResponseDto`, `DiaLiquidacionDto`, `BonoDto`, `TotalesDto` with camelCase fields in `apps/api/src/liquidaciones/dto/liquidacion-response.dto.ts`
- [ ] T015 [US1] Implement `GET /liquidaciones` in `apps/api/src/liquidaciones/liquidaciones.controller.ts`: `@UseGuards(JwtAuthGuard)`, `@Query()` params `colaboradorId` + `semanaId`; calls `assertScope`, `getLiquidacion`; returns `LiquidacionResponseDto`
- [ ] T016 [US1] Implement `LiquidacionesService.patchDiaLiquidacion(id, dto, usuarioId, ip)` in `apps/api/src/liquidaciones/liquidaciones.service.ts`: snapshot `datosAnteriores`; apply partial update fields; call `deriveEstadoDia`; persist updated `DiaLiquidacion`; call `calcularTotales(liquidacion_id)`; call `AuditLiquidacionService.log('DIA_HORAS_AJUSTADAS' | 'DIA_DESCUENTO_APLICADO' | 'DIA_APROBADO', ...)`; return `{dia, totales}`
- [ ] T017 [P] [US1] Create `PatchDiaLiquidacionDto` in `apps/api/src/liquidaciones/dto/patch-dia-liquidacion.dto.ts`: all fields optional; cross-field validators: `@ValidateIf(o => o.horasAjustadasSupervisor !== undefined) @IsNotEmpty() motivoAjuste`; `@ValidateIf(o => o.descuentoTipo !== null) @IsNotEmpty() descuentoValor + descuentoMotivo`; `descuentoValor > 0`
- [ ] T018 [US1] Implement `PATCH /dias-liquidacion/:id` in `apps/api/src/liquidaciones/liquidaciones.controller.ts`: resolve `liquidacion_id` from `dia.liquidacion_id`; call `assertEditable(liquidacion_id)`, `assertScope(req.user.sub, req.user.roles, colaboradorId)`; call `patchDiaLiquidacion(id, dto, usuarioId, ip)`; return 200 `{dia: DiaLiquidacionDto, totales: TotalesDto}`
- [ ] T019 [P] [US1] Create `DiaLiquidacionTable` in `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx`: MUI DataGrid with columns Fecha, Horas Calc., Horas Ajust., Atraso (`Chip` rojo si true), Tarifa Efectiva, Pago Día, Descuento (tipo + valor), Estado (`Chip` con color: SIN_REVISION=default, APROBADO=success, CON_AJUSTE_HORAS=warning, CON_DESCUENTO=info), Acciones (botón "Ajustar"); reads `dias` from `useLiquidacionStore`; emits `onAjustar(diaId)` callback
- [ ] T020 [P] [US1] Create `DiaAjusteDialog` in `apps/web/src/components/liquidaciones/DiaAjusteDialog.tsx`: MUI Dialog + React Hook Form + Zod schema matching `PatchDiaLiquidacionDto` constraints; fields: horas ajustadas (NumberField, ≥ 0), motivo ajuste (TextField), descuentoTipo (Select: ninguno/TARIFA_DIA/MONTO_FIJO), descuentoValor (NumberField, conditional), descuentoMotivo (TextField, conditional), "Aprobar sin penalidad" (Checkbox); on submit: optimistic `applyOptimisticDia` + `applyOptimisticTotales`, then `PATCH /dias-liquidacion/:id` via Axios, then `reconcileDia` + `reconcileTotales`; on error: rollback
- [ ] T021 [P] [US1] Create `LiquidacionSummaryCard` in `apps/web/src/components/liquidaciones/LiquidacionSummaryCard.tsx`: MUI Card with rows for horas ordinarias, horas extra, valor horas ordinarias, valor horas extra, total bonos, total descuentos, **total a pagar** (bold); MUI `Chip` for estado (BORRADOR=warning, APROBADO=success); subscribes to `useLiquidacionStore.totales` and `.estado`; amounts formatted as `Bs. X,XXX.XX`

**Checkpoint**: Boot API + web. Seed a collaborator with biometric `dias_liquidacion` for a week. `GET /liquidaciones` → 200 with all days. Click "Ajustar" on a day with lateness → dialog → submit hour reduction → DataGrid row updates + summary card shows new total. Wrong SUPERVISOR scope → 403.

---

## Phase 4: User Story 2 — Asignación de Bonos por Día (Priority: P2)

**Goal**: Supervisor assigns TRANSPORTE, ALIMENTACION, or GENERICO bonus to a specific day within the period. The total updates immediately. Duplicate bonos (same type + day) are rejected with a pointer to the existing one.

**Independent Test**: `POST /bonos` with `{colaboradorId, semanaId, fechaDia: "2026-05-18", tipo: "TRANSPORTE", monto: 20}` → 201 with `bono` + updated `totales.totalBonos`. Second `POST /bonos` with same type + day → 409 with `existingBonoId`. `DELETE /bonos/:id` → 200 with reduced `totalBonos`.

### Implementation for User Story 2

- [ ] T022 [US2] Implement `LiquidacionesService.createBono(dto, usuarioId, ip)` in `apps/api/src/liquidaciones/liquidaciones.service.ts`: check `prisma.bonos.findFirst({ where: { colaborador_id, fecha_dia, tipo } })`; if exists → throw `HttpException(409, {message: "Ya existe...", existingBonoId: id})`; create bono with `aplicado_por_criterio: false`; call `calcularTotales(liquidacion_id)`; call `AuditLiquidacionService.log('BONO_CREADO', ...)`; return `{bono, totales}`
- [ ] T023 [P] [US2] Create `CreateBonoDto` in `apps/api/src/liquidaciones/dto/create-bono.dto.ts`: `colaboradorId` (UUID), `semanaId` (UUID), `fechaDia` (date string `YYYY-MM-DD`), `tipo` (enum TipoBono), `monto` (number > 0), `justificacion` (string, `@ValidateIf(o => o.tipo === 'GENERICO') @IsNotEmpty()`)
- [ ] T024 [US2] Implement `POST /bonos` in `apps/api/src/liquidaciones/liquidaciones.controller.ts`: resolve `liquidacion_id` from `(colaboradorId, semanaId)`; call `assertEditable`, `assertScope`; call `createBono`; return 201 `{bono, totales}`; on 409 propagate with `existingBonoId` field
- [ ] T025 [US2] Implement `LiquidacionesService.patchBono(id, dto, usuarioId, ip)` and `deleteBono(id, usuarioId, ip)` in `apps/api/src/liquidaciones/liquidaciones.service.ts`: `patchBono` updates monto/justificacion, recalculates, logs `BONO_EDITADO`; `deleteBono` deletes, recalculates, logs `BONO_ELIMINADO`; both return `{totales}`
- [ ] T026 [P] [US2] Create `PatchBonoDto` in `apps/api/src/liquidaciones/dto/patch-bono.dto.ts`: optional `monto` (number > 0) and `justificacion` (string); at least one field required
- [ ] T027 [US2] Implement `PATCH /bonos/:id` and `DELETE /bonos/:id` in `apps/api/src/liquidaciones/liquidaciones.controller.ts`: both call `assertEditable` (resolve `liquidacion_id` from bono), `assertScope`; PATCH calls `patchBono`, DELETE calls `deleteBono`; both return `{totales}` on 200
- [ ] T028 [US2] Create `BonoSectionPanel` in `apps/web/src/components/liquidaciones/BonoSectionPanel.tsx`: MUI Accordion or Card listing bonos grouped by day; "Agregar bono" button reveals inline form (MUI DatePicker within `[semana.fecha_inicio, semana.fecha_fin]`, Select tipo, NumberField monto, conditional TextField justificacion); Edit icon → inline edit form; Delete icon → confirmation `Dialog`; each mutation calls Axios, updates store optimistically, reconciles on response; on 409 shows "Ya existe un bono de TRANSPORTE para este día. Editar el existente?" with link to edit

**Checkpoint**: Add TRANSPORTE bono for Monday → summary total increases. Add second TRANSPORTE for same day → 409 toast with edit link. Delete bono → total decreases. GENERICO bono without justificacion → validation error (frontend + backend).

---

## Phase 5: User Story 3 — Aprobación de la Liquidación Semanal (Priority: P3)

**Goal**: Supervisor approves the weekly liquidation after reviewing all days and assigning all bonos. The liquidation transitions to APROBADO and all edit controls are disabled. Any subsequent mutation attempt returns 409.

**Independent Test**: `POST /liquidaciones/:id/aprobar` → 200 `{estado: "APROBADO", totalPago, aprobadoPor, aprobadaEn}`. Subsequent `PATCH /dias-liquidacion/<any-id>` → 409. Subsequent `POST /bonos` → 409. Navigate to the page after approval → all controls disabled, estado chip shows "APROBADO".

### Implementation for User Story 3

- [ ] T029 [US3] Implement `LiquidacionesService.aprobarLiquidacion(id, usuarioId, ip)` in `apps/api/src/liquidaciones/liquidaciones.service.ts`: call `assertEditable(id)` (409 if already APROBADO); `prisma.liquidaciones_semanales.update({ where: {id}, data: { estado: APROBADO, aprobado_por: usuarioId, aprobada_en: new Date() } })`; call `AuditLiquidacionService.log('LIQUIDACION_APROBADA', 'LiquidacionSemanal', id, {estado: BORRADOR}, {estado: APROBADO}, ...)`; return updated liquidacion
- [ ] T030 [US3] Implement `POST /liquidaciones/:id/aprobar` in `apps/api/src/liquidaciones/liquidaciones.controller.ts`: call `assertScope`; call `aprobarLiquidacion(id, req.user.sub, ip)`; return 200 `{id, estado: 'APROBADO', totalPago, aprobadoPor, aprobadaEn}`
- [ ] T031 [US3] Create `AprobarLiquidacionButton` in `apps/web/src/components/liquidaciones/AprobarLiquidacionButton.tsx`: MUI Button (disabled if `estado === APROBADO`); on click: open MUI `Dialog` with "¿Confirmar aprobación? Esta acción es irreversible."; on confirm: call `POST /liquidaciones/:id/aprobar` via Axios; on 200: call `useLiquidacionStore.setAprobado(aprobadoPor, aprobadaEn)`; the store state change causes `DiaLiquidacionTable` and `BonoSectionPanel` to render all controls as `disabled` (read `estado === APROBADO` from store)
- [ ] T032 [US3] Create `apps/web/src/app/(app)/liquidaciones/[semanaId]/[colaboradorId]/page.tsx`: Next.js server component; calls `GET /liquidaciones?colaborador_id=<param>&semana_id=<param>` with server-side cookie; on 404 → `notFound()`; on 403 → `redirect('/dashboard')`; wraps client components in a `LiquidacionProvider` that initializes the Zustand store with fetched data; renders `DiaLiquidacionTable`, `BonoSectionPanel`, `LiquidacionSummaryCard`, `AprobarLiquidacionButton`

**Checkpoint**: Approve liquidation → `estado` chip changes to APROBADO (green), all table action buttons and bono form disappear. Attempt PATCH via Postman → 409. Reload page → still APROBADO.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: API documentation, unit tests, and integration tests.

- [ ] T033 [P] Add `@ApiTags('liquidaciones')`, `@ApiOperation`, `@ApiResponse(200)`, `@ApiResponse(409)`, `@ApiResponse(403)` decorators to all 6 endpoints in `apps/api/src/liquidaciones/liquidaciones.controller.ts`
- [ ] T034 [P] Write unit tests for `LiquidacionCalculatorService` in `apps/api/src/liquidaciones/services/liquidacion-calculator.service.spec.ts`: test cases: (1) day with TARIFA_DIA discount uses discount rate not configured rate; (2) day with MONTO_FIJO subtracts from pago_dia; (3) day with both hour adjustment AND discount: uses adjusted hours + derived estado = CON_DESCUENTO; (4) day with no adjustments uses horas_calculadas + configured rate; (5) extra hours above UMBRAL_HORA_EXTRA billed at TARIFA_HORA_EXTRA; (6) absent day (0 hours) contributes 0 to totals; (7) weekly sum of all days + bonos = correct totalPago
- [ ] T035 Write supertest integration test for US1 flow in `apps/api/src/liquidaciones/liquidaciones.controller.spec.ts`: seed collaborator + week + dias_liquidacion; GET → PATCH dia with hour adjustment → assert totales updated; PATCH same dia with MONTO_FIJO discount → assert estado = CON_DESCUENTO, totales updated again; PATCH with wrong supervisor scope → 403
- [ ] T036 [P] Write supertest integration test for US3 approval lock: seed + approve via `POST /liquidaciones/:id/aprobar`; then `PATCH /dias-liquidacion/:id` → 409; `POST /bonos` → 409; `POST /liquidaciones/:id/aprobar` again → 409

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 — BLOCKS all user stories (calculator + guards needed everywhere)
- **User Story 1 (Phase 3)**: Requires Phase 2 — delivers MVP (view + adjust days)
- **User Story 2 (Phase 4)**: Requires Phase 2 + `calcularTotales` from Phase 2 (T007); can run in parallel with US1 after Phase 2
- **User Story 3 (Phase 5)**: Requires Phase 2 + `assertEditable` (T008); needs US1 page (T032 renders all child components)
- **Polish (Phase 6)**: Requires all story phases complete

### User Story Dependencies (within Phases)

- **US1**: `getLiquidacion` (T013) → `GET /liquidaciones` (T015) → `patchDiaLiquidacion` (T016) → `PATCH /dias-liquidacion/:id` (T018) → frontend (T019, T020, T021)
- **US2**: `createBono` (T022) → `POST /bonos` (T024); `patchBono+deleteBono` (T025) → `PATCH/DELETE /bonos/:id` (T027); frontend panel (T028) needs all endpoints
- **US3**: `aprobarLiquidacion` (T029) → `POST /liquidaciones/:id/aprobar` (T030) → `AprobarLiquidacionButton` (T031) → `page.tsx` (T032)

### Parallel Opportunities

- T001 || T002 || T004 (Setup — different files)
- T005, T006, T007 are sequential within `LiquidacionCalculatorService` (each builds on prior)
- T008, T009, T010 can run in parallel with T011 and T012 (different files)
- T014 [P] || T017 [P] || T019 [P] || T020 [P] || T021 [P] can run together once T007 + T013 exist
- T023 [P] || T026 [P] can run in parallel once Phase 2 is complete
- T033 [P] || T034 [P] || T036 [P] all run in parallel in Polish phase

---

## Parallel Example: User Story 1

```bash
# After T013 (getLiquidacion) and T007 (calcularTotales) are complete:

# Stage 1 — Backend DTOs + Frontend components run together:
Task T014: "Create LiquidacionResponseDto in apps/api/src/liquidaciones/dto/liquidacion-response.dto.ts"
Task T017: "Create PatchDiaLiquidacionDto in apps/api/src/liquidaciones/dto/patch-dia-liquidacion.dto.ts"
Task T019: "Create DiaLiquidacionTable in apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx"
Task T020: "Create DiaAjusteDialog in apps/web/src/components/liquidaciones/DiaAjusteDialog.tsx"
Task T021: "Create LiquidacionSummaryCard in apps/web/src/components/liquidaciones/LiquidacionSummaryCard.tsx"

# Stage 2 — after DTOs + T015 (GET controller) done:
Task T018: "Implement PATCH /dias-liquidacion/:id in apps/api/src/liquidaciones/liquidaciones.controller.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (scaffold module)
2. Complete Phase 2: Foundational (`LiquidacionCalculatorService` + guards + store)
3. Complete Phase 3: User Story 1 (view + adjust days + summary)
4. **STOP and VALIDATE**: Supervisor can open a week, see all days, adjust hours or apply discount, see total update
5. Deliver: Payroll review is functional — the most critical workflow

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Day-level review + adjustment → MVP (supervisor can work with it)
3. Phase 4 → Bonus assignment → Week payout is complete
4. Phase 5 → Approval + lock → Formal sign-off, ready for payment queue (spec 007)
5. Phase 6 → Tests + docs → Production-ready

---

## Task Summary

| Phase | Tasks | User Story | Parallelizable |
|-------|-------|------------|----------------|
| Phase 1: Setup | T001–T004 | — | T001, T002, T004 |
| Phase 2: Foundational | T005–T012 | — | T011, T012 (with T008–T010) |
| Phase 3: US1 Ajuste | T013–T021 | US1 | T014, T017, T019, T020, T021 |
| Phase 4: US2 Bonos | T022–T028 | US2 | T023, T026 |
| Phase 5: US3 Aprobación | T029–T032 | US3 | — |
| Phase 6: Polish | T033–T036 | — | T033, T034, T036 |

**Total tasks**: 36 | **MVP scope**: T001–T021 (Phases 1–3) | **Parallel opportunities**: 15 tasks

---

## Notes

- `[P]` tasks operate on different files with no dependency on incomplete tasks
- `[US1]/[US2]/[US3]` labels map each task to its user story for independent traceability
- **Prerequisito de datos**: Spec 001 pipeline crea los `DiaLiquidacion` al procesar marcajes. Para desarrollar sin spec 001 implementado, usar seeds de `DiaLiquidacion` directamente en DB
- `LiquidacionCalculatorService.calcularTotales` es llamado después de CADA mutación; si el rendimiento degrada con más días/bonos, considerar optimizar en fases futuras (actualmente ~10 usuarios, aceptable)
- `findOrCreateBorrador` (T010) NO tiene endpoint HTTP; es llamado por el pipeline de spec 001 vía inyección de dependencias
- Commit after each phase checkpoint to preserve incremental progress
- Run `npm run test` in `apps/api` after Phase 6 to validate all tests pass
