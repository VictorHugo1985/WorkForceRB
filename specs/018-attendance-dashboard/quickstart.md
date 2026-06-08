# Quickstart: Attendance Dashboard

## Running the Feature Locally

```bash
# From repo root
cd apps/web
npm run dev
```

Navigate to `http://localhost:3000` (or whichever port is assigned). The dashboard is the home screen — it appears immediately after login.

## Testing the API Directly

```bash
# Must have a valid session cookie — log in via the browser first, then:
curl -b <cookie> "http://localhost:3000/api/dashboard/asistencia?fecha_desde=2026-06-01&fecha_hasta=2026-06-08"
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/app/(app)/dashboard/page.tsx` | Route entry point |
| `apps/web/src/app/(app)/dashboard/DashboardClient.tsx` | Full UI — filters, summary banner, area cards |
| `apps/web/src/app/api/dashboard/asistencia/route.ts` | GET endpoint with SQL query |

## Verifying Auto-Refresh (after patch)

1. Open dashboard with "Hoy" selected.
2. Open browser DevTools → Network tab → filter by `asistencia`.
3. Observe: a new request fires every ~60 seconds.
4. Switch to "Ayer" → requests stop.
5. Switch back to "Hoy" → requests resume.

## TypeScript Check

```bash
cd apps/web && npx tsc --noEmit
```

Should produce no output on success.
