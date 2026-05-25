# Tasks: Autenticación de Usuarios (Login / Logout)

**Feature**: 005-user-login | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Input**: Design documents from `specs/005-user-login/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/api.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label — [US1], [US2], [US3]
- Exact file paths included in each task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and scaffold the AuthModule skeleton so all subsequent phases have a working base.

- [ ] T001 Install backend auth dependencies in `apps/api`: `@nestjs/passport`, `passport`, `passport-local`, `@types/passport-local`, `passport-jwt`, `@types/passport-jwt`, `@nestjs/jwt`, `bcrypt`, `@types/bcrypt`, `cookie-parser`, `@types/cookie-parser`
- [ ] T002 [P] Install frontend auth dependencies in `apps/web`: `react-hook-form`, `zod`, `@hookform/resolvers`, `axios` (if not present)
- [ ] T003 [P] Create `AuthModule` skeleton with empty exports in `apps/api/src/auth/auth.module.ts` (import `PassportModule`, `JwtModule`, `PrismaModule`; export empty providers list)
- [ ] T004 [P] Create empty barrel files for subdirectories: `apps/api/src/auth/strategies/index.ts`, `apps/api/src/auth/guards/index.ts`, `apps/api/src/auth/services/index.ts`, `apps/api/src/auth/dto/index.ts`
- [ ] T005 Register `AuthModule` in `apps/api/src/app.module.ts` imports array

**Checkpoint**: `npm run build` in `apps/api` passes without errors — AuthModule compiles with empty stubs.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB migrations and runtime configuration that MUST be complete before any user story can run against real data.

**⚠️ CRITICAL**: No user story implementation can be tested end-to-end until this phase is complete.

- [ ] T006 Write Prisma migration `add_debe_cambiar_password`: add column `debe_cambiar_password BOOLEAN NOT NULL DEFAULT false` to `usuarios` in `packages/database/prisma/schema.prisma`; run `prisma migrate dev --name add_debe_cambiar_password`
- [ ] T007 Write Prisma migration `multi_rol_usuario`: create table `usuario_roles (usuario_id UUID, rol RolUsuario, PRIMARY KEY (usuario_id, rol))`; expand enum `RolUsuario` with `CAJERO` and `COLABORADOR`; remove column `rol` from `usuarios` in `packages/database/prisma/schema.prisma`; run `prisma migrate dev --name multi_rol_usuario`
- [ ] T008 Regenerate Prisma client: run `prisma generate` in `packages/database`; verify `@workforce/database` exports updated types `UsuarioRol`, `RolUsuario`, `Usuario` (without `rol` field)
- [ ] T009 Register `cookie-parser` middleware in `apps/api/src/main.ts`: `app.use(cookieParser())` before `app.listen()`
- [ ] T010 [P] Configure `@nestjs/throttler` in `apps/api/src/app.module.ts`: `ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }])` as global rate limiter by IP

**Checkpoint**: Run `prisma migrate status` — all migrations applied. Run API server — no startup errors. `GET /health` responds 200.

---

## Phase 3: User Story 1 — Inicio de Sesión con Credenciales Válidas (Priority: P1) 🎯 MVP

**Goal**: A user with any of the 4 roles can authenticate with email + password, receive a JWT in HttpOnly cookie, and get redirected to their dashboard. Brute-force protection blocks after 5 failed attempts for 15 minutes. All attempts are audit-logged.

**Independent Test**: POST `/auth/login` with valid ADMINISTRADOR credentials → 200, `Set-Cookie: access_token`, body `{nombre, roles: ["ADMINISTRADOR"], debeChangiarPassword: false}`. POST with wrong password → 401 generic message. POST 5× with wrong password → 429 with `retryAfterSeconds`. Check `registros_auditoria` table has one row per attempt.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create `LoginDto` with `email: string` (email, maxLength 254) and `password: string` (notEmpty, maxLength 128) using `class-validator` + `nestjs-zod` in `apps/api/src/auth/dto/login.dto.ts`
- [ ] T012 [P] [US1] Create `LoginResponseDto` with `nombre: string`, `roles: RolUsuario[]`, `debeChangiarPassword: boolean` in `apps/api/src/auth/dto/login-response.dto.ts`
- [ ] T013 [US1] Implement `BruteForceService` in `apps/api/src/auth/services/brute-force.service.ts`: `Map<email, {attempts: number, lockedUntil: Date|null}>`; methods: `checkLock(email)` throws `HttpException(429)` if locked and not expired; `recordFailure(email)` increments counter, sets `lockedUntil = now+15min` at attempt 5; `resetOnSuccess(email)` deletes map entry
- [ ] T014 [US1] Implement `LocalStrategy` in `apps/api/src/auth/strategies/local.strategy.ts`: extend `PassportStrategy(Strategy, 'local')`; override `usernameField: 'email'`; in `validate(email, password)`: call `BruteForceService.checkLock(email)`; query `usuarios` + `usuario_roles` via Prisma; verify `activo === true` (→ throw 401); verify `bcrypt.compare(password, password_hash)` (→ `recordFailure` + throw 401); call `resetOnSuccess(email)`; return user object
- [ ] T015 [US1] Implement `LocalAuthGuard` in `apps/api/src/auth/guards/local-auth.guard.ts`: extend `AuthGuard('local')`; override `handleRequest` to propagate `TooManyRequestsException` from `BruteForceService` (status 429) without swallowing it
- [ ] T016 [US1] Implement `AuthService.login()` in `apps/api/src/auth/auth.service.ts`: build JWT payload `{sub, email, nombre, roles, debeChangiarPassword, jti: uuid(), iat: now, exp: now+7200}`; sign with `JwtService`; set cookie `access_token` (HttpOnly, Secure, SameSite=Strict, Path=/, no maxAge); call `updateUltimoAcceso(userId)`; return `LoginResponseDto`
- [ ] T017 [US1] Implement `AuthService.updateUltimoAcceso(userId)` in `apps/api/src/auth/auth.service.ts`: `prisma.usuarios.update({ where: {id: userId}, data: {ultimo_acceso: new Date()} })`
- [ ] T018 [US1] Implement `POST /auth/login` in `apps/api/src/auth/auth.controller.ts`: decorate with `@UseGuards(LocalAuthGuard)`; call `authService.login(req.user, res)`; insert audit row in `registros_auditoria` (`accion: LOGIN_EXITOSO|LOGIN_FALLIDO`, `usuario_id`, `ip` from `x-forwarded-for || req.ip`, `timestamp: NOW()`, `datos_nuevos: {email, motivo_fallo?}`) — use try/catch to log failures even when `LocalAuthGuard` throws; respond 200 with `LoginResponseDto`
- [ ] T019 [P] [US1] Create `apps/web/src/components/auth/LoginForm.tsx`: MUI `TextField` for email and password, submit button; React Hook Form + Zod schema (`email` valid email, `password` notEmpty); on submit call `POST /auth/login` via Axios; on 200 read `debeChangiarPassword` — if true redirect to `/auth/cambiar-contrasena`, else redirect to `returnUrl` query param or role-based dashboard (per spec 010 logic placeholder); on 401 show "Credenciales inválidas"; on 429 show "Cuenta bloqueada temporalmente. Intente en {retryAfterSeconds/60} min."
- [ ] T020 [US1] Create `apps/web/src/app/login/page.tsx`: render `LoginForm` inside MUI `Container`; read `?reason=expired` query param and show inline alert "Tu sesión expiró" when present; read `?reason=inactive` and show "Tu cuenta está inactiva"

**Checkpoint**: Boot API + web. Navigate to `/login`. Log in with a seed ADMINISTRADOR user → cookie set, redirected. Log in with wrong password → 401 toast. Fail 5× → 429 toast. Query `registros_auditoria` → rows present.

---

## Phase 4: User Story 2 — Cierre de Sesión Seguro (Priority: P2)

**Goal**: An authenticated user can click logout from any page. The JWT `jti` is added to an in-memory blacklist immediately, the cookie is cleared, and any subsequent request with the old token is rejected with 401.

**Independent Test**: POST `/auth/login` → get cookie. POST `/auth/logout` with that cookie → 200, `Set-Cookie: access_token=; Max-Age=0`. Replay the old cookie on `GET /auth/me` → 401. Navigate back (browser back button) to a protected page → redirected to `/login`.

### Implementation for User Story 2

- [ ] T021 [US2] Add `jti` blacklist to `AuthService` in `apps/api/src/auth/auth.service.ts`: `private readonly blacklist = new Set<string>()`; add `isBlacklisted(jti: string): boolean`; add `AuthService.logout(jti)` that calls `blacklist.add(jti)`
- [ ] T022 [US2] Implement `JwtStrategy` in `apps/api/src/auth/strategies/jwt.strategy.ts`: extend `PassportStrategy(Strategy, 'jwt')`; extract token from cookie `access_token` via `cookieExtractor = (req) => req.cookies?.access_token`; in `validate(payload)`: verify `!authService.isBlacklisted(payload.jti)` (→ throw `UnauthorizedException`); query `prisma.usuarios.findUnique({where: {id: payload.sub}, select: {activo: true}})` (→ throw 401 if `activo === false`); return payload
- [ ] T023 [US2] Implement `JwtAuthGuard` in `apps/api/src/auth/guards/jwt-auth.guard.ts`: extend `AuthGuard('jwt')`; override `handleRequest` to rethrow `UnauthorizedException` with status 401; used on all protected routes
- [ ] T024 [US2] Implement `POST /auth/logout` in `apps/api/src/auth/auth.controller.ts`: decorate with `@UseGuards(JwtAuthGuard)`; call `authService.logout(req.user.jti)`; clear cookie `access_token` with `Max-Age=0`; respond 200 `{message: "Sesión cerrada correctamente"}`
- [ ] T025 [US2] Add logout button to `apps/web/src/app/(app)/layout.tsx`: MUI `Button` that calls `POST /auth/logout` via Axios; on 200 redirect to `/login`; wrap in a client component `LogoutButton.tsx` in `apps/web/src/components/auth/LogoutButton.tsx`

**Checkpoint**: Login → logout → attempt `GET /auth/me` with old cookie → 401. Refresh protected page after logout → redirect to `/login`.

---

## Phase 5: User Story 3 — Protección de Rutas No Autenticadas (Priority: P3)

**Goal**: Any unauthenticated request to a protected route is redirected to `/login?returnUrl=<original>`. After login, the user is sent back to the original URL. If the session expires mid-navigation, the user sees a "session expired" notice on the login page. Users with `debeChangiarPassword = true` are restricted to `/auth/cambiar-contrasena` only.

**Independent Test**: Open a new browser tab, navigate directly to `/dashboard` without a cookie → redirected to `/login?returnUrl=%2Fdashboard`. Log in → redirected to `/dashboard`. Deactivate the user mid-session, then make any request → 401 → frontend redirects to `/login?reason=inactive`.

### Implementation for User Story 3

- [ ] T026 [US3] Implement Next.js Edge Middleware in `apps/web/middleware.ts`: match all paths except `/_next/`, `/static/`, `/login`, `/auth/cambiar-contrasena`; if request has no `access_token` cookie → `NextResponse.redirect(/login?returnUrl=<encoded-pathname>)`; if request to `/login` with valid cookie → redirect to `/dashboard`
- [ ] T027 [US3] Implement server-side session check in `apps/web/src/app/(app)/layout.tsx`: call `GET /auth/me` from server (passing cookie header); if 401 → redirect to `/login?reason=expired`; if ok → provide user context to child components via React context or props
- [ ] T028 [US3] Implement `GET /auth/me` in `apps/api/src/auth/auth.controller.ts`: decorate with `@UseGuards(JwtAuthGuard)`; return `{sub, email, nombre, roles, debeChangiarPassword}` from `req.user`; if `exp - now < 3600` → call `authService.renewToken(req.user, res)` to re-emit JWT cookie with fresh `exp = now + 7200` (sliding window)
- [ ] T029 [US3] Implement `AuthService.renewToken(payload, res)` in `apps/api/src/auth/auth.service.ts`: build new payload with fresh `jti`, same `sub/email/nombre/roles/debeChangiarPassword`, `exp = now + 7200`; sign and set new `access_token` cookie (same attributes as login)
- [ ] T030 [US3] Add `debeChangiarPassword` route restriction to `JwtAuthGuard` in `apps/api/src/auth/guards/jwt-auth.guard.ts`: in `canActivate`, after JWT validation, if `request.user.debeChangiarPassword === true` and the route is not `/auth/cambiar-contrasena` or `/auth/logout` → throw `ForbiddenException` (403)
- [ ] T031 [P] [US3] Create `apps/web/src/components/auth/SessionExpiredBanner.tsx`: MUI `Alert severity="warning"` shown when `?reason=expired` or `?reason=inactive` present in the URL; auto-hides after 8 seconds; integrate into `apps/web/src/app/login/page.tsx`

**Checkpoint**: All 5 acceptance scenarios from spec.md US3 pass: direct URL access → login redirect; post-login → original URL; session expires → login with banner; `debeChangiarPassword=true` user → only `/auth/cambiar-contrasena` accessible; back-button after logout → login page.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Swagger documentation, unit tests for core services, and throttler wiring.

- [ ] T032 [P] Add `@ApiTags('auth')`, `@ApiOperation`, `@ApiResponse` decorators to all endpoints in `apps/api/src/auth/auth.controller.ts` using `@nestjs/swagger`
- [ ] T033 [P] Write unit tests for `BruteForceService` in `apps/api/src/auth/services/brute-force.service.spec.ts`: test `checkLock` throws 429 when locked; `recordFailure` reaches lockout after 5 calls; `resetOnSuccess` clears counter; lock auto-expires after `lockedUntil` passes
- [ ] T034 [P] Write unit tests for `AuthService` in `apps/api/src/auth/auth.service.spec.ts`: mock `JwtService` and `PrismaService`; test `login()` sets cookie and returns DTO; `logout()` adds jti to blacklist; `isBlacklisted()` returns true for blacklisted jti; `renewToken()` emits new cookie with fresh exp
- [ ] T035 [P] Write unit tests for `LocalStrategy` in `apps/api/src/auth/strategies/local.strategy.spec.ts`: mock Prisma + bcrypt + BruteForceService; test valid credentials → returns user; wrong password → 401 + recordFailure called; inactive user → 401; locked email → 429 propagated
- [ ] T036 [P] Write unit tests for `JwtStrategy` in `apps/api/src/auth/strategies/jwt.strategy.spec.ts`: test valid payload + active user → returns payload; blacklisted jti → 401; `activo = false` in DB → 401
- [ ] T037 Write supertest integration test: login flow end-to-end in `apps/api/src/auth/auth.controller.spec.ts` (integration): `POST /auth/login` with seeded user → 200 + cookie; wrong password → 401; 5× wrong → 429; `POST /auth/logout` → 200 + cookie cleared; old token on `GET /auth/me` → 401; sliding window: token with < 1h life → GET /auth/me response includes new cookie

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 — BLOCKS all user stories (no DB = no tests pass)
- **User Story 1 (Phase 3)**: Requires Phase 2 — delivers MVP auth (login)
- **User Story 2 (Phase 4)**: Requires Phase 2 + `JwtAuthGuard` from Phase 3 logic (T022–T023 can start after T003)
- **User Story 3 (Phase 5)**: Requires Phase 2 + `JwtAuthGuard` (T022–T023); benefits from Phase 3 login being testable
- **Polish (Phase 6)**: Requires all story phases complete

### User Story Dependencies (within Phases)

- **US1**: `BruteForceService` (T013) → `LocalStrategy` (T014) → `LocalAuthGuard` (T015) → `AuthService.login` (T016) → Controller (T018) → Frontend (T019–T020)
- **US2**: `AuthService.logout+blacklist` (T021) → `JwtStrategy` (T022) → `JwtAuthGuard` (T023) → Controller (T024) → Frontend (T025)
- **US3**: `JwtStrategy`+`JwtAuthGuard` from US2 (T022–T023) → `GET /auth/me` (T028) → sliding window (T029) → debeChangiarPassword guard (T030) → frontend middleware (T026–T027) → SessionExpiredBanner (T031)

### Parallel Opportunities

- T001 (backend deps) || T002 (frontend deps) || T003 (AuthModule skeleton) can run together
- T006 (migration 1) and T007 (migration 2) are sequential (T007 depends on T006 schema state)
- T011 (LoginDto) || T012 (LoginResponseDto) || T013 (BruteForceService) can run together
- T019 (LoginForm) || T020 (login page) can run in parallel once Axios is installed
- T033 || T034 || T035 || T036 (all unit tests) run in parallel

---

## Parallel Example: User Story 1

```bash
# Stage 1 — run together after T008 (Prisma client generated):
Task T011: "Create LoginDto in apps/api/src/auth/dto/login.dto.ts"
Task T012: "Create LoginResponseDto in apps/api/src/auth/dto/login-response.dto.ts"
Task T013: "Implement BruteForceService in apps/api/src/auth/services/brute-force.service.ts"
Task T019: "Create LoginForm component in apps/web/src/components/auth/LoginForm.tsx"

# Stage 2 — after T013:
Task T014: "Implement LocalStrategy in apps/api/src/auth/strategies/local.strategy.ts"

# Stage 3 — after T014:
Task T015: "Implement LocalAuthGuard in apps/api/src/auth/guards/local-auth.guard.ts"
Task T016: "Implement AuthService.login() in apps/api/src/auth/auth.service.ts"

# Stage 4 — after T015 + T016:
Task T018: "Implement POST /auth/login in apps/api/src/auth/auth.controller.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps, scaffold)
2. Complete Phase 2: Foundational (DB migrations, cookie-parser, throttler)
3. Complete Phase 3: User Story 1 (login + brute-force + audit + frontend form)
4. **STOP and VALIDATE**: `POST /auth/login` works end-to-end; audit rows created; brute-force triggers 429
5. Deliver: Users can log in — the system is usable

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Login works → MVP (any user can authenticate)
3. Phase 4 → Logout works → Sessions terminate securely
4. Phase 5 → Route protection → Unauthenticated access blocked; session expiry handled
5. Phase 6 → Tests + docs → Feature production-ready

### Single Developer Sequence

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010
→ T011/T012/T013 → T014 → T015 → T016/T017 → T018 → T019 → T020
→ T021 → T022 → T023 → T024 → T025
→ T026 → T027 → T028 → T029 → T030 → T031
→ T032/T033/T034/T035/T036 → T037
```

---

## Task Summary

| Phase | Tasks | User Story | Parallelizable |
|-------|-------|-----------|----------------|
| Phase 1: Setup | T001–T005 | — | T001, T002, T003, T004 |
| Phase 2: Foundational | T006–T010 | — | T010 |
| Phase 3: US1 Login | T011–T020 | US1 | T011, T012, T013, T019 |
| Phase 4: US2 Logout | T021–T025 | US2 | — |
| Phase 5: US3 Route Protection | T026–T031 | US3 | T031 |
| Phase 6: Polish | T032–T037 | — | T032, T033, T034, T035, T036 |

**Total tasks**: 37 | **MVP scope**: T001–T020 (Phases 1–3) | **Parallel opportunities**: 14 tasks

---

## Notes

- `[P]` tasks operate on different files with no dependency on incomplete tasks — safe to run in parallel
- `[US1]/[US2]/[US3]` labels map each task to its user story for independent traceability
- DB migrations (T006, T007) must coordinate with spec 009 — verify `usuario_roles` migration is not already applied before running T007
- `BruteForceService` blacklist and `jti` blacklist are in-memory: lost on process restart (acceptable for MVP per research.md Decision 2)
- `JwtStrategy` queries `activo` from DB on every authenticated request (FR-003); performance overhead is acceptable for ~10 concurrent users (MVP scale)
- Commit after each checkpoint to preserve incremental progress
- Run `npm run test` in `apps/api` after Phase 6 tasks complete to validate all unit + integration tests pass
