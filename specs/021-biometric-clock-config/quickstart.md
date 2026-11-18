# Quickstart: Configuración de Relojes Biométricos

## Running Locally

No migration needed. Start the web app:

```bash
cd apps/web && npm run dev
```

Navigate to `http://localhost:3000/relojes` after login as ADMINISTRADOR.

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/nav-config.ts` | Add `/relojes` to NAV_ITEMS and ROUTE_ROLES |
| `apps/web/src/components/layout/AppSidebar.tsx` | Add `AccessTimeIcon` for `/relojes` |
| `apps/web/src/app/api/dispositivos/route.ts` | Extend GET (all fields) + add POST |
| `apps/web/src/app/api/dispositivos/[id]/route.ts` | New PATCH handler |
| `apps/web/src/app/(app)/relojes/page.tsx` | New server page |
| `apps/web/src/components/relojes/RelojesListClient.tsx` | New client component |

## Manual Test Scenarios

### Scenario 1: View and register a new WEBHOOK device

1. Log in as ADMINISTRADOR → navigate to "Configuración Reloj" in the sidebar.
2. Verify the list shows existing devices (active and inactive).
3. Click "Nuevo Reloj" → enter name "Reloj Test", serial "TEST001", tipo WEBHOOK, secreto "mysecret".
4. Save → verify the new device appears in the list with estado Activo and an indicator that it has a webhook secret.

### Scenario 2: Edit a device

1. Click the edit icon on any active device.
2. Change its name → save.
3. Verify the updated name appears in the list.

### Scenario 3: Inactivate and reactivate

1. Click "Inactivar" on an active device → confirm.
2. Verify the device shows estado "Inactivo" in the list.
3. Click "Activar" → verify it returns to "Activo".

### Scenario 4: Duplicate serial number rejected

1. Try to register a new device with a serial number already in use.
2. Verify the system shows an error "Ya existe un dispositivo con ese número de serie." and does not save.

### Scenario 5: SUPERVISOR cannot access

1. Log in as SUPERVISOR → verify "Configuración Reloj" is NOT visible in the sidebar.
2. Attempt direct navigation to `/relojes` → should redirect to `/login` or show access denied.

## TypeScript Check

```bash
cd apps/web && npx tsc --noEmit
```

Should produce no output on success.
