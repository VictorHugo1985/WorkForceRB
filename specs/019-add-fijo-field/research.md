# Research: Tipo de Colaborador — Campo Fijo

**Phase 0 output for `019-add-fijo-field`**

---

## Decision 1: Migration Format

**Decision**: Raw SQL migration file at `apps/api/prisma/migrations/20260618_025_add_fijo_colaborador/migration.sql`, consistent with all 24 existing migrations in the project.

**Rationale**: The project does not use `prisma migrate` CLI for schema generation — migrations are hand-authored SQL files in the established `YYYYMMDD_NNN_description/` directory structure. Using the same pattern keeps the migration history consistent.

**Migration SQL**:
```sql
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS fijo BOOLEAN NOT NULL DEFAULT false;
-- DOWN: ALTER TABLE colaboradores DROP COLUMN fijo;
```

**Alternatives considered**:
- `prisma migrate dev` → Rejected; the project doesn't use Prisma CLI for migrations in production.

---

## Decision 2: Exclusion Point in Liquidation Engine

**Context**: The planilla roster query in `apps/web/src/app/api/planilla/[semanaId]/route.ts` is where collaborators are selected for inclusion in the liquidation calculation. The existing WHERE clause already filters by `tipo_pago`.

**Decision**: Add `AND c.fijo = false` to the roster SQL `WHERE` clause on `colaboradores`. This is the single, authoritative exclusion point.

**Rationale**:
- All downstream liquidation routes (`liquidacion_colaborador`, `liquidacion_jornada`, etc.) are created from the planilla roster. Excluding at this source prevents any downstream records from being created for `fijo` collaborators — no partial state to clean up.
- The `liquidaciones/route.ts` GET endpoint already fetches by `colaborador_id + semana_id` — since no row is ever created for `fijo` collaborators, they naturally return 404 there too.
- No change required to the `liquidacion-db.ts` calculation engine or the detail routes.

**Alternatives considered**:
- Filter in `liquidacion-db.ts` calculation logic → Rejected; would require changes deeper in the engine for no benefit.
- Filter in the planilla UI frontend → Rejected; server is the correct enforcement point per Constitution.

---

## Decision 3: UI Widget — Fijo Toggle

**Decision**: MUI `Switch` (boolean toggle) in `Step1DatosPersonales` of the registration wizard, labelled "Colaborador Fijo" with helper text explaining the implication ("Los colaboradores fijos no participan en el cálculo de liquidaciones por horas."). Same `Switch` in the collaborator edit form, disabled when the viewer is not ADMINISTRADOR.

**Rationale**:
- The field is binary (fijo / jornalero) — a `Switch` communicates this clearly with minimal UI space.
- Placing it in `Step1DatosPersonales` alongside other classification fields (nombre, apellido, cedula) makes it part of the initial registration decision.
- The wizard already uses `checkAdminRole` on the POST route, so no additional permission enforcement needed on the frontend (server always validates).

**Alternatives considered**:
- Dedicated new wizard step → Rejected; a single boolean field doesn't warrant a full step.
- `ToggleButtonGroup` with "Fijo" / "Jornalero" options → Viable but a Switch is more space-efficient for a single boolean.

---

## Decision 4: Collaborator List Display

**Decision**: Add a MUI `Chip` (`"Fijo"` in warning color / `"Jornalero"` in default/outline) to each row in `ColaboradoresListClient`. Add a filter toggle above the table (chip group: "Todos" / "Fijo" / "Jornalero") matching the existing `activo` filter UX pattern.

**Rationale**: Matches FR-006 (list shows type + filter). The existing list already uses chips and filter chips for `activo`, making this a natural extension of the existing pattern.

**Alternatives considered**:
- New column with text label → Less visually scannable than a chip.
- No filter in this feature, deferred to US3 → Kept in scope since it's US3 priority and low complexity.
