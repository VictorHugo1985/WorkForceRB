# Research: Gestión de Liquidación Semanal

**Feature**: 006-weekly-payroll | **Date**: 2026-05-25

---

## Decision 1 — Placement of Payroll Calculation Logic

**Decision**: All payroll arithmetic (`pago_dia = horas_efectivas × tarifa_efectiva + horas_extra × tarifa_extra − descuento_monto_fijo`) lives exclusively in a dedicated `LiquidacionCalculatorService` in the backend (`apps/api`). The frontend never re-implements this formula; it receives updated totals in each PATCH/POST response.

**Rationale**: Principle IV (Cálculo Determinístico y Auditable) requires that recalculating any closed week must produce the same result at any future point. Keeping the formula in a single service guarantees a single source of truth, enables audit-trail generation alongside the calculation, and prevents client-side drift from backend logic. The service is also unit-testable in isolation.

**Alternatives considered**:
- Client-side calculation for instant feedback: rejected because it duplicates business logic and requires keeping formula in sync across API and UI. A response < 200ms from a PATCH call makes server-side calculation indistinguishable from client-side for the user, satisfying SC-002.
- Stored procedure in PostgreSQL: rejected because it moves business logic into the DB layer, making it harder to version, test, and audit alongside the codebase.

---

## Decision 2 — Mutation API Shape: PATCH /dias-liquidacion/:id vs. Separate Endpoints

**Decision**: A single `PATCH /dias-liquidacion/:id` endpoint accepts a partial update body with all possible adjustments (hour override, discount type/value/reason, explicit state approval). Each call returns the updated `DiaLiquidacion` plus the recalculated `LiquidacionSemanal` totals so the frontend can update in one round trip.

**Rationale**: DiaLiquidacion adjustments (hour fix, discount, approval) are all writes to the same row. A single PATCH endpoint avoids explosion of endpoints and keeps the controller thin. The combined response (day + parent totals) eliminates the need for a second `GET` to refresh the summary, satisfying SC-002 (< 2s update).

**Alternatives considered**:
- Separate endpoints (`POST /dias-liquidacion/:id/ajustar-horas`, `POST /dias-liquidacion/:id/descuento`, `POST /dias-liquidacion/:id/aprobar`): more explicit but creates boilerplate and requires multiple round trips if the supervisor applies both an hour adjustment and a discount.
- GraphQL mutations: rejected — this project uses REST (constitution Stack Tecnológico).

---

## Decision 3 — Handling `estado_dia` When Both Adjustments Coexist

**Decision**: `estado_dia` is derived by the backend from the presence of modifications, not set directly by the client. Priority rule: if `descuento_tipo IS NOT NULL` → `CON_DESCUENTO`; else if `horas_ajustadas_supervisor IS NOT NULL` → `CON_AJUSTE_HORAS`; else if supervisor explicitly approves with no adjustments → `APROBADO`; else → `SIN_REVISION`. When a day has both an hour adjustment and a discount (allowed per edge case), the backend sets `CON_DESCUENTO` (most restrictive/visible state). The motivo_ajuste field documents the hour reason; descuento_motivo documents the discount reason — both are preserved.

**Rationale**: The enum `estado_dia` is a display state, not a bitfield. Two independent modifications on the same day are captured in their respective fields; the single state value reflects the most significant change for the supervisor's summary view. This is the simplest approach without requiring a compound enum or bitfield that would complicate queries and UI rendering.

**Alternatives considered**:
- Add `CON_AJUSTE_Y_DESCUENTO` compound state: explicit but adds complexity to the enum and every switch/case in the codebase. Not worth it for MVP with ~10 users.
- Two separate boolean flags (`tiene_ajuste_horas`, `tiene_descuento`): more expressive but requires both UI and queries to combine them — more complex than a derived single state.

---

## Decision 4 — Real-Time Total Update Strategy (SC-002 ≤ 2 seconds)

**Decision**: Optimistic UI update pattern: the frontend calculates the expected new total immediately using cached config values (tarifa, umbral) and shows it pending confirmation. The PATCH/POST response body includes the authoritative `LiquidacionSemanal` totals; the UI reconciles silently if there's any diff. If the backend rejects the call (conflict, validation error), the optimistic update is rolled back.

**Rationale**: NestJS handles a PATCH with Prisma update + recalculate in < 100ms locally. Even with network latency, the perceived update is instant for the user because the optimistic value shows immediately. This avoids a "calculating…" spinner that would worsen UX. If the optimistic value is wrong (edge case: tarifa changed mid-session), the reconciliation on response corrects it.

**Alternatives considered**:
- Server-Sent Events or WebSocket to push recalculated totals: overkill for a ~10-user MVP with synchronous supervisor workflow.
- Pure server-round-trip (no optimism): safe but shows a loading state on every keystroke/click, violating SC-002 feel.

---

## Decision 5 — Approval Lock Enforcement

**Decision**: `POST /liquidaciones/:id/aprobar` transitions `estado` from `BORRADOR` → `APROBADO`. All subsequent `PATCH /dias-liquidacion/:id` and `POST /bonos` calls check `liquidacion.estado === 'APROBADO'` and return `409 Conflict` with body `{message: "La liquidación ya fue aprobada y no puede modificarse"}`. The check lives in `LiquidacionesService.assertEditable(liquidacionId)` — a guard method called at the start of every mutation.

**Rationale**: Principle IV (immutability of approved liquidation) and FR-009 require this. A dedicated guard method centralizes the check, ensuring no mutation path bypasses it. 409 Conflict is semantically correct: the server understood the request but the current state conflicts.

**Alternatives considered**:
- 403 Forbidden: semantically implies permission error, not state conflict. 409 is more accurate.
- Database-level trigger to block updates: prevents accidental direct DB changes but hides the enforcement logic from the application layer and makes it harder to surface user-facing error messages.

---

## Decision 6 — Automatic BORRADOR Creation (FR-010) Integration with Spec 001

**Decision**: The `LiquidacionesService.findOrCreateBorrador(colaboradorId, semanaId)` method is exposed as an injectable service call (not an HTTP endpoint). The spec 001 biometric processing pipeline calls it as part of its event-processing workflow. This avoids HTTP overhead on internal calls and keeps the creation logic in the `LiquidacionesModule`.

**Rationale**: FR-010 says the BORRADOR is created when the first biometric event of the week is processed. The spec 001 pipeline (webhook/CSV processing) triggers this. Since both modules live in the same NestJS app, direct service injection is cleaner than an internal HTTP call. `findOrCreateBorrador` is idempotent: if a liquidacion already exists for that collaborator × week, it returns the existing one without creating a duplicate.

**Alternatives considered**:
- Cron job that creates BORRADORs for all active collaborators at week start: simpler scheduling but wastes rows for collaborators who don't show up that week.
- HTTP event from spec 001: unnecessary overhead for same-process communication.

---

## Decision 7 — Audit Logging for Payroll Mutations (FR-011)

**Decision**: All write operations (PATCH /dias-liquidacion, POST/PATCH/DELETE /bonos, POST /liquidaciones/:id/aprobar) call `AuditService.log(...)` after the successful DB write. The audit record captures: `accion` (string code), `entidad_tipo` + `entidad_id`, `datos_anteriores` (JSON snapshot before), `datos_nuevos` (JSON snapshot after), `usuario_id` (from JWT payload), `ip_origen`. This uses the existing `registros_auditoria` table from spec 003.

**Rationale**: Principle IX (Trazabilidad Obligatoria) and FR-011 require full audit of all manual adjustments with before/after values. The existing `registros_auditoria` table already covers the schema needed. A shared `AuditService` from a common module (or `AuthModule`) avoids duplicating the insert logic.

**Alternatives considered**:
- Separate audit table per entity: would require schema changes and complex joins for audit views. Single `registros_auditoria` table is already defined in spec 003.
- Event sourcing for all changes: far too complex for MVP with ~10 users and low mutation volume.
