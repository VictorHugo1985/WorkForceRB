# Research: Eliminar Período de Liquidación

## Decision 1 — Auth guard: `checkAdminRole` vs `checkLiquidacionRole`

**Decision**: Use `checkAdminRole` (imported from `@/lib/auth-server`).

**Rationale**: The spec explicitly restricts deletion to ADMINISTRADOR. The existing PATCH `/api/semanas-laborales/[id]` uses `checkLiquidacionRole` (which allows SUPERVISOR), but deletion is a more destructive action. `checkAdminRole` is the established pattern for admin-only writes across the codebase (collaborators, users). SUPERVISOR should not be able to delete periods.

**Alternatives considered**: `checkLiquidacionRole` — rejected because it permits SUPERVISOR access, violating FR-001.

---

## Decision 2 — Cascade strategy: application-level transaction

**Decision**: Delete dependent records explicitly in a single SQL transaction before deleting the period.

**Rationale**: The FK relationships from `bonos.semana_id` and `liquidacion_colaborador.semana_id` to `liquidacion_periodo` do not have ON DELETE CASCADE at the DB level (not set in Prisma schema). An explicit ordered delete within a transaction is the safest approach without adding schema migrations. Order:
1. Delete `dias_liquidacion` whose `liquidacion_id` belongs to the period
2. Delete `liquidacion_colaborador` (BORRADOR only; APROBADO/PAGADO blocked before this point)
3. Delete `bonos` for the period
4. Delete `liquidacion_periodo` row

**Alternatives considered**: Adding `ON DELETE CASCADE` migration — rejected because it is a schema change that could affect existing production FK behavior and is out of scope for this feature.

---

## Decision 3 — API route: `DELETE /api/semanas-laborales/[id]`

**Decision**: Add a `DELETE` handler to the existing `apps/web/src/app/api/semanas-laborales/[id]/route.ts`.

**Rationale**: REST convention for resource deletion. The file already exists and exports `GET` and `PATCH`; adding `DELETE` is a minimal, cohesive extension. No new route file needed.

**Alternatives considered**: `POST /api/semanas-laborales/[id]/eliminar` — rejected as non-idiomatic and inconsistent with the `DELETE` method used elsewhere in REST APIs.

---

## Decision 4 — UI: IconButton + confirmation Dialog

**Decision**: Add a delete IconButton (using `DeleteIcon`) to the actions column in `SemanasListClient.tsx`, visible only when `isAdmin && s.estado === 'ABIERTA'`. On click, open a confirmation Dialog (reusing the existing Dialog pattern from the create flow in the same file). On confirmation, call `DELETE /api/semanas-laborales/[id]` and remove the row from state on success.

**Rationale**: Consistent with the existing "Cerrar" IconButton pattern in the same component. The `isAdmin` prop is already passed from the page. A Dialog (not a `confirm()`) matches the existing create dialog and provides a better UX.

**Alternatives considered**: Inline confirmation with `window.confirm()` — already used by "Cerrar" but rejected here because it doesn't allow showing period details clearly or an error from a blocked deletion.

---

## Decision 5 — Eligibility check: server-side, not client-side

**Decision**: Eligibility (ABIERTA + no APROBADO/PAGADO liquidaciones) is enforced only server-side. The delete button is hidden for CERRADA periods in the UI (client-side convenience), but the server is authoritative.

**Rationale**: Follows existing pattern (Cerrar button hidden for CERRADA in UI, but server also rejects). Prevents race conditions where a period could be approved between page load and the user clicking delete.

**Alternatives considered**: Client-side pre-check via API call before showing button — rejected as unnecessary complexity; the server returns a clear error message on conflict.
