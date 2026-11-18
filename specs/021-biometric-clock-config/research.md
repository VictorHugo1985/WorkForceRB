# Research: Configuración de Relojes Biométricos

## Decision 1 — Route path: `/relojes`

**Decision**: New page at `/relojes` with sidebar label "Configuración Reloj".

**Rationale**: The existing `/configuracion` route is already in the sidebar (currently a "ComingSoon" placeholder). Adding device management there would expand its scope beyond what's currently designed. `/relojes` is domain-specific, clean, and parallel to `/colaboradores`, `/eventos`, etc. The user explicitly asked for a new sidebar option.

**Alternatives considered**: Sub-route of `/configuracion` (e.g., `/configuracion/relojes`) — rejected because the existing `/configuracion` page has no sub-routing structure yet; creating it would require a layout refactor beyond this feature's scope.

---

## Decision 2 — Webhook secret handling: store and manage, never return in GET

**Decision**: `webhook_secreto` is stored as plaintext in `dispositivos_biometricos` (already the DB design). The API **never returns the actual secret** in any GET response — instead returns a boolean `tiene_webhook_secreto` indicating whether one is configured. On edit, if the user leaves the secret field blank, the existing value is preserved; if they enter a new value, it replaces the old one.

**Rationale**: The field already exists in the schema and the model was designed for it. The current webhook handler in `/api/webhooks/crosschex/route.ts` uses `process.env.CROSSCHEX_WEBHOOK_SECRET` (not the DB field) — changing that validation is out of scope for this feature. This feature manages the data; a future feature can wire up the DB-stored secret to the webhook validation.

**Alternatives considered**:
- Hashing the secret with bcrypt — rejected because the webhook handler needs to compare the raw received secret, not a hash; bcrypt comparison would require changes to the webhook handler which is out of scope.
- Returning masked value (e.g., `"••••••"`) — rejected as unnecessary; a boolean flag `tiene_webhook_secreto: boolean` is sufficient and avoids exposing any part of the secret.

---

## Decision 3 — API structure: extend existing route + add `[id]` route

**Decision**: Extend `apps/web/src/app/api/dispositivos/route.ts` (add POST handler; expand GET to return all devices with all fields). Add new `apps/web/src/app/api/dispositivos/[id]/route.ts` for PATCH.

**Rationale**: The existing GET at `/api/dispositivos` only returns active devices with 3 fields (`id, nombre, numero_serie`) for the collaborator registration dropdown. The admin management view needs all fields and all devices (active + inactive). Rather than adding complexity to the existing limited GET, the admin GET will simply replace it — `checkAdminRole` is already the guard, so there's no security regression. The existing consumers (collaborator form) will continue to work because they only use `id` and `nombre` from the response.

**Alternatives considered**: New route at `/api/admin/dispositivos` — rejected as unnecessary indirection; the existing route with `checkAdminRole` is already admin-only.

---

## Decision 4 — UI component: `RelojesListClient.tsx` with inline dialogs

**Decision**: Single client component `apps/web/src/components/relojes/RelojesListClient.tsx` containing the full list view, a "Nuevo Reloj" dialog for creation, and an "Editar" dialog for modification. Activate/inactivate is a direct action (no dialog — uses a `window.confirm` or an inline toggle, consistent with the LockIcon pattern in SemanasListClient).

**Rationale**: Follows the established pattern across the codebase: server page (`page.tsx`) fetches initial data → client component manages all UI interactions. Single-component approach keeps the feature self-contained.

**Alternatives considered**: Separate wizard / multi-step form — rejected as over-engineering for 5 fields.

---

## Decision 5 — Sidebar icon: `AccessTimeIcon` from `@mui/icons-material`

**Decision**: Use `AccessTimeIcon` for the `/relojes` entry in the sidebar icon map.

**Rationale**: "Reloj" literally means clock; `AccessTimeIcon` (a clock face) is the most semantically accurate icon. It's already available in the `@mui/icons-material` package used throughout the app. `FingerprintIcon` (already used for `/eventos`) would cause confusion. `RouterIcon` (network device) could also work but is less intuitive for end users.

**Alternatives considered**: `RouterIcon`, `DevicesIcon`, `SettingsInputComponentIcon` — all rejected in favor of the more obvious `AccessTimeIcon`.

---

## Decision 6 — No schema migration needed

**Decision**: No database changes. All required fields already exist in `dispositivos_biometricos`.

**Rationale**: The table was designed with all necessary fields:
- `nombre` (String, required)
- `numero_serie` (String?, unique, nullable)
- `tipo` (TipoDispositivo: WEBHOOK | CSV)
- `activo` (Boolean, default true)
- `webhook_secreto` (String?, nullable)
- `creado_en`, `actualizado_en` (timestamps, auto-managed)

No migration required. The Prisma schemas (`apps/api/prisma/schema.prisma`, `packages/database/prisma/schema.prisma`) already include the `DispositivoBiometrico` model.
