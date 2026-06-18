# Quickstart: Tipo de Colaborador — Campo Fijo

## Running Locally

```bash
# Apply the migration first (run once against your local DB):
psql $DATABASE_URL -f apps/api/prisma/migrations/20260618_025_add_fijo_colaborador/migration.sql

# Start the web app:
cd apps/web && npm run dev
```

Navigate to `http://localhost:3000` after login.

## Key Files

| File | Purpose |
|------|---------|
| `apps/api/prisma/migrations/20260618_025_add_fijo_colaborador/migration.sql` | DB migration — run once |
| `packages/database/prisma/schema.prisma` | Prisma schema — add `fijo Boolean @default(false)` |
| `apps/api/prisma/schema.prisma` | Same as above |
| `apps/web/src/app/api/colaboradores/route.ts` | GET list + POST create |
| `apps/web/src/app/api/colaboradores/[id]/route.ts` | GET profile + PATCH edit |
| `apps/web/src/app/api/planilla/[semanaId]/route.ts` | Exclusion point for fijo |
| `apps/web/src/components/colaboradores/steps/Step1DatosPersonales.tsx` | Fijo toggle in wizard |
| `apps/web/src/components/colaboradores/ColaboradorPerfil.tsx` | Profile badge |
| `apps/web/src/app/(app)/colaboradores/ColaboradoresListClient.tsx` | List chip + filter |

## Manual Test Scenarios

### Scenario 1: Register a fijo collaborator

1. Log in as ADMINISTRADOR → navigate to Colaboradores → Nuevo.
2. In Step 1, toggle "Colaborador Fijo" ON.
3. Complete and submit the wizard.
4. Open the new collaborator's profile → verify "Fijo" badge is visible.

### Scenario 2: Fijo excluded from planilla

1. Ensure the `fijo` collaborator has biometric codes and punch events for the current week.
2. Open Semanas Laborales → select the active week → view Planilla.
3. Verify the `fijo` collaborador does NOT appear in the planilla roster.
4. Open another collaborator with `fijo = false` → verify they DO appear.

### Scenario 3: Reclassify an existing collaborator

1. Open a `jornalero` collaborator's profile → click Editar.
2. Toggle "Colaborador Fijo" ON → save.
3. Verify profile shows "Fijo" badge.
4. Re-run Scenario 2 to verify exclusion now applies.

### Scenario 4: SUPERVISOR cannot edit

1. Log in as SUPERVISOR → navigate to a collaborator's profile.
2. Verify the "Fijo" field is visible but the toggle is disabled (read-only).

## TypeScript Check

```bash
cd apps/web && npx tsc --noEmit
```

Should produce no output on success.
