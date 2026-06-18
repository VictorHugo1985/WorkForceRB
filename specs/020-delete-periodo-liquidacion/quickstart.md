# Quickstart: Eliminar Período de Liquidación

## Running Locally

No migration needed. Start the web app:

```bash
cd apps/web && npm run dev
```

Navigate to `http://localhost:3000/semanas-laborales` after login as ADMINISTRADOR.

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/semanas-laborales/[id]/route.ts` | Add `DELETE` handler |
| `apps/web/src/components/semanas/SemanasListClient.tsx` | Add delete button + confirmation dialog |

## Manual Test Scenarios

### Scenario 1: Delete a period with no liquidaciones

1. Log in as ADMINISTRADOR → navigate to Semanas Laborales.
2. Create a new period (if none exists with ABIERTA status).
3. Click the delete icon on the period → confirm in the dialog.
4. Verify the period disappears from the list and a success snackbar appears.

### Scenario 2: Blocked — period has approved liquidaciones

1. Open a period that has at least one collaborator with estado APROBADO in liquidaciones.
2. Click the delete icon → confirm.
3. Verify the period remains in the list and an error message is shown explaining that it has finalized liquidaciones.

### Scenario 3: Blocked — period is CERRADA

1. Locate a period with estado CERRADA (the delete button should not be visible).
2. Attempt a direct DELETE request to `/api/semanas-laborales/<id>` with the CERRADA period's ID.
3. Verify the API returns 422 with the appropriate message.

### Scenario 4: SUPERVISOR cannot delete

1. Log in as SUPERVISOR → navigate to Semanas Laborales.
2. Verify the delete icon is not visible on any period.
3. Optionally: attempt a direct DELETE request → verify 403 FORBIDDEN.

## TypeScript Check

```bash
cd apps/web && npx tsc --noEmit
```

Should produce no output on success.
