# Research: Attendance Dashboard

**Phase 0 output for `018-attendance-dashboard`**

## Implementation Status

The core implementation was shipped as part of the previous session (`017-period-date-marcacion-calc`). Three files were created and committed:

| File | Status |
|------|--------|
| `apps/web/src/app/(app)/dashboard/page.tsx` | ✅ Complete |
| `apps/web/src/app/(app)/dashboard/DashboardClient.tsx` | ✅ Complete |
| `apps/web/src/app/api/dashboard/asistencia/route.ts` | ✅ Complete |

**All functional requirements FR-001 through FR-012 are already implemented.**

Two items require attention before the feature is constitutionally compliant.

---

## Decision 1: Auto-Refresh Strategy (FR-014 / Constitution Principle X)

**Constitution Principle X** requires:
> La vista de asistencia activa DEBE reflejar los eventos biométricos con una latencia máxima de 60 segundos desde el evento al dashboard.

**Current state**: The dashboard fetches data only when the user changes filters or loads the page. There is no auto-refresh.

**Decision**: Add a 60-second polling interval on the "Hoy" quick filter only. No polling for historical queries.

**Rationale**:
- Polling every 60 seconds satisfies the constitutional requirement.
- Limiting polling to the "Hoy" filter avoids unnecessary queries when the user is reviewing historical data.
- SSE (Server-Sent Events) would be more efficient but introduces significant new infrastructure (streaming route, keep-alive management) for a low-event-rate scenario. Polling is proportionate.
- WebSockets are out of scope for this MVP feature.

**Alternatives considered**:
- Manual "Actualizar" button only → Rejected; does not satisfy Constitution X's 60-second requirement.
- SSE / WebSocket → Rejected for this feature; disproportionate complexity for low-frequency biometric events.
- Global polling regardless of filter → Rejected; wastes server resources on historical queries.

---

## Decision 2: COLABORADOR Role Access

**Constitution Principle VIII** states:
> **Colaborador**: acceso básico al sistema — vista de inicio.

**Spec FR-013** states:
> The dashboard MUST be restricted to ADMINISTRADOR or SUPERVISOR roles.

**Conflict**: The constitution gives the COLABORADOR role access to "vista de inicio" (the home/dashboard screen), but the spec restricts the attendance data to ADMINISTRADOR and SUPERVISOR.

**Decision**: The attendance dashboard remains restricted to ADMINISTRADOR and SUPERVISOR at the data level. The "vista de inicio" for COLABORADOR will be a separate, future feature (a personal view of their own attendance and schedule). The current dashboard is explicitly a supervisory/administrative tool.

**Rationale**:
- Attendance data for all collaborators is sensitive. Showing all collaborators' attendance to a COLABORADOR would be a privacy violation.
- The constitution describes COLABORADOR's "vista de inicio" as delivering "acceso básico" — this is intended for a personal dashboard, not the supervisory overview.
- This interpretation is consistent with the spec and with industry norms for HRIS systems.
- The feature roadmap note in the constitution (`specs/009-create-system-user` and `specs/010-role-based-nav`) documents COLABORADOR as an in-progress role definition; the personal dashboard is out of scope here.

**Alternatives considered**:
- Show all collaborators' attendance to COLABORADOR → Rejected; privacy concern.
- Show only the logged-in collaborador's own attendance → Deferred to a future COLABORADOR-specific feature.

---

## Decision 3: Timezone Handling (already resolved)

All date/time calculations use the `utc_offset` column stored on each `eventos_biometricos_desglosados` row (`-4` for Bolivia/UTC-4), consistent with Spec 017. No hardcoded offsets remain in the dashboard code.

---

## Decision 4: Query Performance

**Current state**: The SQL CTE in `GET /api/dashboard/asistencia` joins `eventos_biometricos_desglosados` → `codigos_colaborador` → `colaboradores` → `areas` and uses a LEFT JOIN to include colaboradores with no events. This is a single query with `json_agg` grouping.

**Decision**: No additional optimization needed at current scale (up to ~200 active collaboradores per the spec's SC-002 target). Existing indexes on `codigos_colaborador.codigo_biometrico` and `eventos_biometricos_desglosados.checktime` are sufficient.

**Rationale**: SC-002 requires under 3 seconds for 200 collaboradores. The current query structure is well within that bound for the expected data volume.
