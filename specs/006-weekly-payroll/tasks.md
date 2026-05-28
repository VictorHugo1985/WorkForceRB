# Tasks: Gestión de Liquidación Semanal

**Feature**: 006-weekly-payroll | **Date**: 2026-05-28
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Prerequisites**: spec 003 v2.0 migrations applied; spec 005 auth module active (`JwtAuthGuard` available in `apps/api/src/auth/`)

**No tests requested** — implementation only (TDD not specified in spec).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in same phase
- **[Story]**: User story label (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Database migrations, module skeleton, install missing dependency

- [X] T001 Apply 2 DB migrations via Prisma to `apps/api`: (1) add `CON_AJUSTE_Y_DESCUENTO` to `EstadoDia` enum in `dias_liquidacion`; (2) rename `bonos.justificacion` → `bonos.comentario` and set NOT NULL for all rows. Create migration files under `apps/api/prisma/migrations/`.
- [X] T002 Install `zustand` in `apps/web` (`pnpm add zustand` from workspace root or `apps/web`), then create the NestJS `LiquidacionesModule` directory with empty stub files: `apps/api/src/liquidaciones/liquidaciones.module.ts`, `liquidaciones.controller.ts`, `liquidaciones.service.ts`, `dto/` folder, `services/` folder. Register `LiquidacionesModule` in `apps/api/src/app.module.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core services, calculator, and navigation shell — required by all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement `LiquidacionCalculatorService` in `apps/api/src/liquidaciones/services/liquidacion-calculator.service.ts`. Methods required: `calcularTotales(liquidacionId: string)` — reads all `DiaLiquidacion` rows + `bonos` for the period via Prisma; resolves `tarifa_efectiva_dia` (COLABORADOR rule via `configuraciones_reglas` first, GLOBAL fallback; override if `descuento_tipo=TARIFA_DIA` using `descuento_valor`); reads `MULTIPLICADOR_HORA_EXTRA` config rule (default 1.5 if none found); computes `tarifa_extra_dia = tarifa_efectiva_dia × multiplicador`; applies FR-008 formula per day (`horas_efectivas = horas_ajustadas_supervisor ?? horas_calculadas`, `pago_dia = (horas_ord × tarifa_eff) + (horas_extra × tarifa_extra) - descuento_fijo`); sums all totals; persists to `liquidaciones_semanales` (horas_ordinarias, horas_extra, valor_horas_ordinarias, valor_horas_extra, total_bonos, total_descuentos, total_pago, configuracion_reglas_ids as UUID[], calculado_en). Also implement `deriveEstadoDia(horas_ajustadas: number|null, descuento_tipo: string|null, aprobar: boolean): EstadoDia` returning `CON_AJUSTE_Y_DESCUENTO` when both non-null, `CON_DESCUENTO` when only descuento_tipo set, `CON_AJUSTE_HORAS` when only horas_ajustadas set, `APROBADO` when `aprobar=true`, else `SIN_REVISION`.
- [X] T004 [P] Implement `LiquidacionesService` base methods in `apps/api/src/liquidaciones/liquidaciones.service.ts`: `getLiquidacion(colaboradorId: string, semanaId: string)` — Prisma `findFirst` with `include: { dias_liquidacion: { orderBy: { fecha: 'asc' } }, bonos: { orderBy: { fecha_dia: 'asc' } } }`; `assertEditable(liquidacionId: string)` — throws `ConflictException('La liquidación ya fue aprobada y no puede modificarse')` if `estado = APROBADO`; `assertScope(userId: string, roles: string[], colaboradorId: string)` — if SUPERVISOR role only, query `colaboradores.supervisor_id` and throw `ForbiddenException('No tiene acceso a este colaborador')` if mismatch; `findOrCreateBorrador(colaboradorId: string, semanaId: string)` — Prisma `upsert` on `UNIQUE(colaborador_id, semana_id)` with `estado=BORRADOR`. Inject `PrismaService` and `LiquidacionCalculatorService`.
- [X] T005 [P] Create DTOs in `apps/api/src/liquidaciones/dto/`: `LiquidacionResponseDto` (full shape per contracts/api.md GET /liquidaciones — include nested `dias` array and `bonos` array with `comentario` field, not `justificacion`); `PatchDiaLiquidacionDto` with `class-validator`: `@IsOptional() @IsNumber() @Min(0) horasAjustadasSupervisor`, `@ValidateIf() @IsString() motivoAjuste`, `@IsOptional() @IsEnum(TipoDescuentoDia) descuentoTipo`, `@ValidateIf() @IsNumber() @IsPositive() descuentoValor`, `@ValidateIf() @IsString() descuentoMotivo`, `@IsOptional() @IsBoolean() aprobar`. Add `@ValidateIf` cross-field: motivoAjuste required if horasAjustadasSupervisor set; descuentoValor + descuentoMotivo required if descuentoTipo set.
- [X] T006 Implement `GET /liquidaciones`, `GET /liquidaciones/resumen`, and `GET /semanas-laborales` in `apps/api/src/liquidaciones/liquidaciones.controller.ts`. Use `@UseGuards(JwtAuthGuard)` on the controller class with `@Roles('ADMINISTRADOR','SUPERVISOR')`. `GET /liquidaciones?colaborador_id&semana_id`: call `assertScope` then `getLiquidacion` → return `LiquidacionResponseDto`. `GET /liquidaciones/resumen?semana_id`: if `semana_id` absent, resolve active week from `semanas_laborales` where `estado=ABIERTA` (first result); query `colaboradores` in scope with left join `liquidaciones_semanales`; return shape per contracts/api.md. `GET /semanas-laborales`: return all rows ordered by `fecha_inicio DESC`.
- [X] T007 [P] Create Next.js API proxy routes (these forward requests to NestJS at `process.env.API_URL`, attaching the `access_token` cookie as `Authorization: Bearer <token>`): `apps/web/src/app/api/liquidaciones/route.ts` (GET → NestJS GET /liquidaciones); `apps/web/src/app/api/liquidaciones/resumen/route.ts` (GET → NestJS GET /liquidaciones/resumen); `apps/web/src/app/api/semanas-laborales/route.ts` (GET → NestJS GET /semanas-laborales). All use `NextRequest`, read `cookies().get('access_token')`, and return the proxied JSON response.
- [X] T008 Create `apps/web/src/components/liquidaciones/LiquidacionesListClient.tsx` (Client Component, `'use client'`): props `{ semanaActiva: SemanaLaboral; semanas: SemanaLaboral[]; liquidaciones: LiquidacionResumen[] }`. Renders: (1) MUI `Select` dropdown of semanas (label: `${fecha_inicio} – ${fecha_fin}`) bound to semanaActiva; on change call `router.push('/liquidaciones?semana_id=' + id)`; (2) MUI `Table` size="small" with columns: Colaborador (nombre + apellido), Área, Estado (Chip: success=APROBADO/warning=BORRADOR/default=SIN LIQUIDACIÓN), Total a Pagar (`${monto.toLocaleString('es-VE')} Bs.` or `—` if null); (3) Row onClick → `router.push(\`/liquidaciones/${semanaActiva.id}/${colaboradorId}\`)`. Then create `apps/web/src/app/(app)/liquidaciones/page.tsx` (Server Component): verify auth, read optional `?semana_id` from `searchParams`, call `GET /api/liquidaciones/resumen?semana_id` and `GET /api/semanas-laborales`, pass to `LiquidacionesListClient`.
- [X] T009 [P] Create Zustand store `apps/web/src/stores/liquidacion.store.ts` with `create<LiquidacionStore>()`: state fields `liquidacion: LiquidacionData | null`; actions `setLiquidacion(data)`, `applyOptimisticDia(dia)` (replaces matching dia in `liquidacion.dias` by id), `reconcileDia(dia)` (same as apply), `applyOptimisticTotales(totales)` (merges totales fields), `reconcileTotales(totales)` (same), `setAprobado(aprobadoPor, aprobadaEn)` (sets `estado=APROBADO`). Then create `apps/web/src/app/(app)/liquidaciones/[semanaId]/[colaboradorId]/page.tsx` (Server Component): fetch `GET /api/liquidaciones?colaborador_id=<id>&semana_id=<id>`, pass data to `LiquidacionDetailClient` (client component that initializes the store via `setLiquidacion` on mount and renders empty `<DiaLiquidacionTable />`, `<BonoSectionPanel />`, `<LiquidacionSummaryCard />`, `<AprobarLiquidacionButton />` placeholder slots).

**Checkpoint**: Lista de liquidaciones accessible at `/liquidaciones`, datos del período visibles in detail view, Zustand store initialized

---

## Phase 3: User Story 1 — Revisión y Ajuste de Asistencias (Priority: P1) 🎯 MVP

**Goal**: Supervisor can view each day's hours, detect tardiness, apply hour adjustments and daily discounts, and see totals update in real time.

**Independent Test**: Navigate to `/liquidaciones/<semana>/<colaborador>`, verify 7 days appear with `horas_calculadas` and `atraso_detectado` flags. Apply `horasAjustadasSupervisor=7` with motivo to a day → verify total recalculates. Apply `descuentoTipo=MONTO_FIJO` + `descuentoValor=50` to another day → verify `total_descuentos` and `total_pago` update. Apply `descuentoTipo=TARIFA_DIA` to another day → verify day's rate changes but not other days.

- [X] T010 [US1] Implement `LiquidacionesService.patchDiaLiquidacion(id, dto, userId, roles)` in `apps/api/src/liquidaciones/liquidaciones.service.ts`: fetch `DiaLiquidacion` with `include: { liquidacion: true }`; call `assertEditable(liquidacion.id)` and `assertScope(userId, roles, liquidacion.colaborador_id)`; Prisma update DiaLiquidacion fields (horasAjustadasSupervisor, motivoAjuste, descuentoTipo, descuentoValor, descuentoMotivo); compute and persist `estado_dia` via `deriveEstadoDia`; call `calcularTotales(liquidacion.id)`; return `{ dia: updated, totales: { horasOrdinarias, horasExtra, valorHorasOrdinarias, valorHorasExtra, totalBonos, totalDescuentos, totalPago, calculadoEn } }`. Add `PATCH /dias-liquidacion/:id` to `LiquidacionesController` using `PatchDiaLiquidacionDto`.
- [X] T011 [P] [US1] Create Next.js API proxy route `apps/web/src/app/api/dias-liquidacion/[id]/route.ts` (PATCH → NestJS `PATCH /dias-liquidacion/:id` forwarding body and auth cookie, returning JSON response).
- [X] T012 [US1] Create `apps/web/src/components/liquidaciones/DiaLiquidacionTable.tsx` (Client Component, reads from Zustand store): MUI `Table` size="small". Columns: Fecha (format DD/MM from YYYY-MM-DD), Entrada Registrada, Horas Calc., Horas Ajust. (`—` if null), Atraso (red `Chip` label="Atraso" if `atraso_detectado`, else empty), Tarifa Eff. (Bs./h), Descuento (tipo badge + value), Pago Día (Bs.), Estado (`Chip`: SIN_REVISION=default/"Sin rev.", APROBADO=success/"Aprobado", CON_AJUSTE_HORAS=info/"H. ajustadas", CON_DESCUENTO=warning/"Con descuento", CON_AJUSTE_Y_DESCUENTO=warning/"Ajuste + Desc."), Acciones (Button "Ajustar" — disabled if `liquidacion.estado=APROBADO`). Days with no `DiaLiquidacion` record show as "Ausente" row with 0 horas.
- [X] T013 [US1] Create `apps/web/src/components/liquidaciones/DiaAjusteDialog.tsx`: MUI Dialog with title "Ajustar día — {DD/MM/YYYY}". React Hook Form + Zod (schema mirrors `PatchDiaLiquidacionDto`): NumberField horasAjustadasSupervisor (≥0, optional), TextField motivoAjuste (required if horas set), Select descuentoTipo (Sin descuento / Reducción de tarifa / Monto fijo), NumberField descuentoValor (>0, required if tipo set), TextField descuentoMotivo (required if tipo set), Checkbox "Aprobar día sin ajuste". On submit: (1) store.applyOptimisticDia with merged values (instant); (2) PATCH /api/dias-liquidacion/:id; (3) on success: store.reconcileDia(dia) + store.applyOptimisticTotales(totales); (4) on 409/422: rollback optimistic update, show error Alert. Create `apps/web/src/components/liquidaciones/LiquidacionSummaryCard.tsx` (Client Component): MUI Card reading from store — rows for horas ordinarias, horas extra, valor ord. (Bs.), valor extra (Bs.), total bonos (Bs.), total descuentos (Bs.), **Total a Pagar** (Typography variant="h6", bold), Estado Chip (warning=BORRADOR, success=APROBADO), `calculado_en` timestamp. Wire `DiaLiquidacionTable`, `DiaAjusteDialog`, and `LiquidacionSummaryCard` into `LiquidacionDetailClient`.

**Checkpoint**: US1 fully functional — hour adjustments and daily discounts work with real-time total updates

---

## Phase 4: User Story 2 — Asignación de Bonos por Día (Priority: P2)

**Goal**: Supervisor can add, edit, and delete daily bonuses (TRANSPORTE/ALIMENTACION/GENERICO) with free-form amount and required comment. Totals update in real time.

**Independent Test**: On a BORRADOR week, POST TRANSPORTE bonus 20 Bs. + comment for Monday → `total_bonos` increases by 20. POST second TRANSPORTE for same day → 409 with suggestion to edit existing. PATCH bonus monto to 25 Bs. → total updates. DELETE bonus → total reverts.

- [X] T014 [US2] Implement `LiquidacionesService.createBono()`, `patchBono()`, `deleteBono()` in `apps/api/src/liquidaciones/liquidaciones.service.ts`. `createBono(dto, userId, roles)`: assertEditable + assertScope via parent liquidacion; check `UNIQUE(colaborador_id, fecha_dia, tipo)` → if exists, throw `ConflictException` with `{ message: "Ya existe un bono de tipo X para este día...", existingBonoId }`; Prisma create with `comentario` (required for all types); call `calcularTotales`; return `{ bono, totales }`. `patchBono(id, dto, userId, roles)`: assertEditable + assertScope; Prisma update; recalculate; return. `deleteBono(id, userId, roles)`: assertEditable + assertScope; Prisma delete; recalculate; return. Create `CreateBonoDto` (`tipo: TipoBono`, `monto: number`, `comentario: string` — required for all, `colaboradorId: UUID`, `semanaId: UUID`, `fechaDia: string`). Create `PatchBonoDto` (partial: `monto`, `comentario`). Add `POST /bonos`, `PATCH /bonos/:id`, `DELETE /bonos/:id` endpoints to `LiquidacionesController`.
- [X] T015 [P] [US2] Create Next.js API proxy routes: `apps/web/src/app/api/bonos/route.ts` (POST → NestJS POST /bonos with body + auth) and `apps/web/src/app/api/bonos/[id]/route.ts` (PATCH → NestJS PATCH /bonos/:id; DELETE → NestJS DELETE /bonos/:id), all forwarding auth cookie.
- [X] T016 [US2] Create `apps/web/src/components/liquidaciones/BonoSectionPanel.tsx` (Client Component): reads bonuses from Zustand store's `liquidacion.bonos`. Renders flat list sorted by `fechaDia` — each row: date (DD/MM), tipo `Chip` (color-coded), monto (`${monto.toLocaleString('es-VE')} Bs.`), comentario (truncated 40 chars), edit IconButton, delete IconButton (with confirm). "Agregar bono" `Button` opens inline MUI `Collapse` form: date input constrained to `[semana.fechaInicio, semana.fechaFin]`, tipo Select (TRANSPORTE/ALIMENTACION/GENERICO), monto NumberField, comentario TextField (required). On submit: store.applyOptimisticTotales (add monto); POST /api/bonos; on success reconcile; on 409 show inline `Alert` "Ya existe un bono de tipo {X} para este día — edite el existente" with link to scroll to that row. DELETE: optimistic remove → DELETE /api/bonos/:id → reconcile or rollback.
- [X] T017 [US2] Integrate `BonoSectionPanel` into `LiquidacionDetailClient` in `apps/web/src/app/(app)/liquidaciones/[semanaId]/[colaboradorId]/page.tsx`, placed below `DiaLiquidacionTable`. Pass `semanaId` and `semanaFechas` (fechaInicio/fechaFin) as props for date constraints.

**Checkpoint**: US1 + US2 fully functional — bonuses add to totals, duplicates rejected with clear messaging

---

## Phase 5: User Story 3 — Aprobación de Liquidación Semanal (Priority: P3)

**Goal**: Supervisor approves the weekly payroll, locking all further modifications.

**Independent Test**: After reviewing days, click "Aprobar liquidación" → confirm in Dialog → estado = APROBADO (green Chip). Try PATCH dia-liquidacion → 409. Try POST bono → 409. Reload page → all edit controls still disabled.

- [X] T018 [US3] Implement `LiquidacionesService.aprobarLiquidacion(id, userId, roles)` in `apps/api/src/liquidaciones/liquidaciones.service.ts`: fetch liquidacion; `assertEditable(id)` (throws 409 if already APROBADO); `assertScope(userId, roles, liquidacion.colaborador_id)`; Prisma update `{ estado: 'APROBADO', aprobado_por: userId, aprobada_en: new Date() }`; return `{ id, estado, totalPago, aprobadoPor, aprobadaEn }`. Add `POST /liquidaciones/:id/aprobar` to `LiquidacionesController`.
- [X] T019 [P] [US3] Create Next.js API proxy route `apps/web/src/app/api/liquidaciones/[id]/aprobar/route.ts` (POST → NestJS POST /liquidaciones/:id/aprobar with auth cookie; no body needed).
- [X] T020 [US3] Create `apps/web/src/components/liquidaciones/AprobarLiquidacionButton.tsx` (Client Component): MUI `Button` variant="contained" color="success" label="Aprobar liquidación"; disabled when `store.liquidacion.estado === 'APROBADO'`. On click: MUI `Dialog` "¿Desea aprobar la liquidación de {nombre} para la semana {fechaInicio}–{fechaFin}? Esta acción es irreversible." On confirm: POST /api/liquidaciones/:id/aprobar → store.setAprobado(aprobadoPor, aprobadaEn) → all DiaAjusteDialog Ajustar buttons disabled (read `store.liquidacion.estado` from store), all BonoSectionPanel add/edit/delete controls disabled, AprobarLiquidacionButton itself disabled. On 409: show `Alert` inline. Integrate into `LiquidacionDetailClient`.

**Checkpoint**: All 3 user stories complete — approved liquidación is immutable across reloads

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Audit logging compliance, module wiring validation, acceptance scenario verification

- [X] T021 Create `apps/api/src/liquidaciones/services/audit-liquidacion.service.ts` with method `log(accion, entidadTipo, entidadId, datosAnteriores, datosNuevos, userId, ip)` that inserts into `registros_auditoria` via Prisma. Inject into `LiquidacionesService` and add audit calls (wrapped in try/catch — failure must not block response) for: `patchDiaLiquidacion` → `DIA_HORAS_AJUSTADAS` or `DIA_DESCUENTO_APLICADO` or `DIA_APROBADO`; `createBono` → `BONO_CREADO`; `patchBono` → `BONO_EDITADO`; `deleteBono` → `BONO_ELIMINADO`; `aprobarLiquidacion` → `LIQUIDACION_APROBADA`. Include `datos_anteriores` snapshot (Prisma state before update) and `datos_nuevos` (state after).
- [X] T022 [P] Verify `apps/api/src/liquidaciones/liquidaciones.module.ts` exports and `apps/api/src/app.module.ts` registration are correct. Run `pnpm --filter api build` to confirm TypeScript compiles with zero errors. Fix any import/type issues.
- [X] T023 [P] Validate all acceptance scenarios from `specs/006-weekly-payroll/spec.md` User Scenarios section: US1 scenarios 1–4, US2 scenarios 1–3, US3 scenarios 1–3, plus all 6 Edge Cases. Document discrepancies and fix any found issues.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Requires Phase 2 — **MVP stop point**
- **US2 (Phase 4)**: Requires Phase 2 — independent of US1, can run in parallel with Phase 3 if staffed
- **US3 (Phase 5)**: Requires Phase 2 — `assertEditable` already in place
- **Polish (Phase 6)**: Requires all desired phases complete

### Within Each Phase

- Tasks marked `[P]` within the same phase can run in parallel (operate on different files)
- Sequential tasks must run in order listed

---

## Parallel Execution Examples

### Phase 2 Foundational

```
# Parallel batch:
T003 LiquidacionCalculatorService
T004 LiquidacionesService base methods
T005 DTOs
T007 Next.js proxy routes

# After T003+T004+T005 complete:
T006 Controller GET endpoints (needs service + DTOs)
T008 List page + LiquidacionesListClient (needs T007 proxy routes)
T009 Zustand store + detail page shell
```

### Phase 3 US1

```
# Sequential:
T010 patchDiaLiquidacion service + PATCH endpoint

# Parallel after T010:
T011 Next.js PATCH proxy route
T012 DiaLiquidacionTable component

# After T011 + T012:
T013 DiaAjusteDialog + LiquidacionSummaryCard + page integration
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1: Setup (T001–T002)
2. Phase 2: Foundational (T003–T009)
3. Phase 3: US1 (T010–T013)
4. **STOP and VALIDATE**: Supervisor reviews attendance, adjusts hours/discounts, totals update

### Incremental Delivery

1. Phase 1 + 2 → Foundation: list and detail pages load data
2. + Phase 3 (US1) → Attendance adjustment ✓ **MVP**
3. + Phase 4 (US2) → Daily bonuses ✓
4. + Phase 5 (US3) → Payroll approval lock ✓
5. + Phase 6 → Audit trails ✓

---

## Notes

- Backend: NestJS + Prisma at `apps/api/`; auth via `JwtAuthGuard` from `apps/api/src/auth/`
- Frontend: Next.js 16 + MUI v9 at `apps/web/`; state via Zustand (must install: `pnpm add zustand`)
- All monetary values in Bs. (`toLocaleString('es-VE')`)
- Dates displayed DD/MM/YYYY; stored YYYY-MM-DD in DB
- `comentario` required for ALL bono types (not just GENERICO)
- `estado_dia` derived by backend only; frontend never sends it
- `tarifa_extra = tarifa_efectiva_dia × MULTIPLICADOR_HORA_EXTRA` (config rule, default 1.5)
- Audit logging is best-effort (try/catch — never blocks response)
- `CON_AJUSTE_Y_DESCUENTO` is the correct state when both hour adjustment AND discount coexist on the same day
