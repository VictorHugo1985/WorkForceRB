# Implementation Plan: Autenticación de Usuarios (Login / Logout)

**Branch**: `005-user-login` | **Date**: 2026-05-23 | **Spec**: [spec.md](spec.md)

## Summary

Implementar el ciclo completo de autenticación (login + logout) para los cuatro roles del sistema
(ADMINISTRADOR, SUPERVISOR, CAJERO, COLABORADOR) mediante Passport (estrategias `local` + `jwt`),
con JWT almacenado en cookie HttpOnly/SameSite=Strict y ventana deslizante de inactividad de 2h.
Incluye protección anti-fuerza bruta en memoria (5 intentos → lockout 15 min por correo),
revocación inmediata de sesión al hacer logout (blacklist `jti` en memoria), detección del flag
`debe_cambiar_password` para redirigir al flujo de cambio obligatorio, y log de auditoría de todos
los intentos de login.

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**:
- NestJS — framework base (`apps/api`)
- `@nestjs/passport`, `passport`, `passport-local`, `passport-jwt` — estrategias de auth
- `jsonwebtoken` / `@nestjs/jwt` — emisión y verificación de JWT
- `bcrypt` — comparación de hash de contraseña
- `@nestjs/throttler` — rate limiting por IP (capa adicional)
- `class-validator` + Zod + `nestjs-zod` — validación de DTOs
- `@nestjs/swagger` — documentación de endpoints
- Prisma (`@workforce/database`) — consultas a `usuarios` y `usuario_roles`
- Next.js 14 (App Router) — `apps/web` (página de login, guards de ruta)
- MUI v5 (Material UI 5.15) + Emotion 11 — formulario de login
- React Hook Form + Zod — validación del formulario en cliente
- Axios — llamadas HTTP desde el frontend

**Storage**: PostgreSQL vía Prisma. Dos migraciones aditivas al modelo base (spec 003):
- Enmienda 1: columna `debe_cambiar_password BOOLEAN NOT NULL DEFAULT false` en `usuarios`
- Enmienda 2: eliminar campo `rol` de `usuarios`, crear tabla `usuario_roles` (M:N), expandir
  enum `RolUsuario` con `CAJERO` y `COLABORADOR`
  *(Enmienda 2 coordinada con spec 009 — ver data-model.md)*

**Testing**: Jest (unit: `LocalStrategy`, `JwtStrategy`, `BruteForceService`, `AuthService`);
supertest (integration: login flow, logout + blacklist, cookie sliding window); Playwright/RTL
opcional para el formulario frontend.

**Target Platform**: NestJS server (`apps/api`) + Browser (`apps/web`)

**Performance Goals**:
- Login exitoso completado en ≤1s (incluye bcrypt.compare + Prisma query + JWT sign)
- Verificación de JWT en cada request ≤20ms adicionales
- Sin consulta a DB en requests intermedios para verificar expiración (JWT es stateless salvo la
  comprobación de jti en memoria)

**Constraints**:
- Cookie de sesión (no persistente): `max-age` no establecido; expira al cerrar el navegador
- JWT expira a los 2h; se renueva en cada request si la vida restante < 1h
- El blacklist de `jti` es en memoria: se pierde al reiniciar el proceso (aceptable para MVP)
- El contador de brute-force es en memoria: ídem
- `debeChangiarPassword` en JWT payload evita consulta adicional a DB por request
- Enmienda 2 (multi-rol) coordinada con spec 009; spec 005 la declara como dependencia

**Scale/Scope**: ~10 usuarios concurrentes, 4 roles, MVP

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Arquitectura Basada en Datos | ✅ | Migraciones aditivas documentadas en data-model.md; modelo aprobado antes de implementar |
| II. Código Limpio y Modular | ✅ | `AuthModule` independiente con `BruteForceService`, `LocalStrategy`, `JwtStrategy`, `AuthService` |
| IV. Cálculo Determinístico y Auditable | ✅ | FR-010: log de auditoría de cada intento (exitoso/fallido) con timestamp e IP |
| VIII. RBAC (v1.1.0) | ✅ | Los cuatro roles se autentican con el mismo mecanismo; acceso diferencial en features posteriores |
| XI. Seguridad y Protección de Datos | ✅ | JWT en HttpOnly cookie, SameSite=Strict, bcrypt para contraseñas, throttler + brute-force por correo, jti blacklist para revocación inmediata |

## Project Structure

### Documentation (this feature)

```text
specs/005-user-login/
├── plan.md          ← este archivo
├── research.md      ← 6 decisiones técnicas (cookie vs header, sliding window, jti blacklist...)
├── data-model.md    ← 2 enmiendas al modelo base (spec 003) + JWT payload + BruteForce state
├── contracts/
│   └── api.md       ← endpoints POST /auth/login, POST /auth/logout, GET /auth/me
└── tasks.md         ← (generado por /speckit-tasks)
```

### Source Code

```text
apps/api/
├── prisma/
│   └── migrations/
│       └── YYYYMMDDHHMMSS_add_debe_cambiar_password/   # Enmienda 1
│           └── migration.sql
│       └── YYYYMMDDHHMMSS_multi_rol_usuario/           # Enmienda 2 (coordinada con spec 009)
│           └── migration.sql
├── src/
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.controller.ts           # POST /auth/login, POST /auth/logout, GET /auth/me
│       ├── auth.controller.spec.ts
│       ├── auth.service.ts              # login(), logout(), renewToken()
│       ├── auth.service.spec.ts
│       ├── strategies/
│       │   ├── local.strategy.ts        # Valida email + password via passport-local
│       │   ├── local.strategy.spec.ts
│       │   ├── jwt.strategy.ts          # Extrae JWT de cookie, verifica firma + jti blacklist
│       │   └── jwt.strategy.spec.ts
│       ├── guards/
│       │   ├── local-auth.guard.ts      # Activa LocalStrategy en POST /auth/login
│       │   ├── jwt-auth.guard.ts        # Activa JwtStrategy en rutas protegidas
│       │   └── jwt-auth.guard.spec.ts
│       ├── services/
│       │   └── brute-force.service.ts   # Map<email, { attempts, lockedUntil }>
│       │   └── brute-force.service.spec.ts
│       └── dto/
│           ├── login.dto.ts             # { email: string; password: string }
│           └── login-response.dto.ts    # { nombre, roles, debeChangiarPassword }

apps/web/
├── src/
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx                 # Formulario de login (MUI + React Hook Form + Zod)
│   │   └── (app)/                       # Rutas protegidas (layout con auth check)
│   │       └── layout.tsx               # Middleware/layout: verifica sesión activa
│   └── components/auth/
│       ├── LoginForm.tsx                # Formulario con campo email, password, submit
│       └── SessionExpiredBanner.tsx     # Banner de sesión expirada / cerrada
└── middleware.ts                        # Next.js middleware: redirige a /login si no autenticado
```

**Structure Decision**: Monorepo (apps/api + apps/web). `AuthModule` en módulo propio en el backend.
`BruteForceService` y el blacklist `jti` son servicios internos del `AuthModule` (no expuestos).
El middleware de Next.js cubre la protección de rutas en el frontend; el `JwtAuthGuard` cubre
los endpoints del backend.

## Implementation Phases

### Fase A — Migración de Base de Datos (Prerequisito)

1. Enmienda 1: añadir columna `debe_cambiar_password BOOLEAN NOT NULL DEFAULT false` a `usuarios` en
   `packages/database/prisma/schema.prisma`. Crear y aplicar migración `add_debe_cambiar_password`.
2. Enmienda 2: coordinar con spec 009 para la creación de `usuario_roles` y expansión de
   `RolUsuario`. Si spec 009 no está implementado aún, aplicar la migración en esta feature y
   documentar la dependencia; si ya está aplicada, verificar compatibilidad.
3. Regenerar Prisma client (`prisma generate`).
4. Verificar que `@workforce/database` exponga los tipos `UsuarioRol` y `RolUsuario` actualizados.

### Fase B — Backend: AuthModule + Estrategias Passport

1. Instalar dependencias: `@nestjs/passport`, `passport`, `passport-local`, `@types/passport-local`,
   `passport-jwt`, `@types/passport-jwt`, `@nestjs/jwt`, `bcrypt`, `@types/bcrypt`,
   `cookie-parser` (si no está instalado).
2. Crear `AuthModule` con imports de `PassportModule`, `JwtModule` (configurado con secreto y
   sin expiración — la expiración se pone en el payload), `PrismaModule`.
3. Implementar `LocalStrategy`:
   - Extrae `email` y `password` de la request
   - Consulta `usuarios` con `usuario_roles` via Prisma (`SELECT … LEFT JOIN usuario_roles`)
   - Verifica `activo = true` (→ 401 si no)
   - Verifica `bcrypt.compare(password, password_hash)` (→ 401 si falla)
   - Delega incremento/reset de contador brute-force a `BruteForceService`
   - Retorna el objeto usuario para que el controller lo use en `req.user`
4. Implementar `JwtStrategy`:
   - Extrae el token de la cookie `access_token` (via `cookieExtractor`)
   - Verifica firma + expiración (passport-jwt maneja esto)
   - Verifica que `jti` no esté en el blacklist del `AuthService`
   - Retorna el payload del JWT como `req.user`
5. Implementar `BruteForceService`:
   - `Map<email, { attempts: number; lockedUntil: Date | null }>`
   - `checkLock(email)`: lanza `TooManyRequestsException` si `lockedUntil` futuro; limpia si expiró
   - `recordFailure(email)`: incrementa contador; si llega a 5 → `lockedUntil = now + 15min`
   - `resetOnSuccess(email)`: elimina la entrada del Map
6. Implementar `AuthService`:
   - `login(user)`: emite JWT con payload completo (`sub`, `email`, `nombre`, `roles`,
     `debeChangiarPassword`, `jti` = UUID, `iat`, `exp = now + 2h`), escribe cookie HttpOnly
   - `logout(jti)`: agrega `jti` al blacklist en memoria
   - `renewIfExpiringSoon(payload)`: si `exp - now < 1h` → emite nuevo JWT y reemplaza la cookie
   - `updateUltimoAcceso(userId)`: UPDATE `usuarios.ultimo_acceso = NOW()`
7. Unit tests para `LocalStrategy`, `JwtStrategy`, `BruteForceService`, `AuthService`.

### Fase C — Backend: Controller y Guards

1. Implementar `LocalAuthGuard` (activa `LocalStrategy`).
2. Implementar `JwtAuthGuard`:
   - Activa `JwtStrategy`
   - Cuando `debeChangiarPassword = true` en el payload: permite solo `/auth/cambiar-contrasena`
     y `/auth/logout` (FR-012)
3. Implementar `AuthController`:
   - `POST /auth/login`: usa `LocalAuthGuard`; llama `AuthService.login()`; registra auditoría;
     responde 200 con `{ nombre, roles, debeChangiarPassword }` (token en cookie, no en body)
   - `POST /auth/logout`: usa `JwtAuthGuard`; llama `AuthService.logout(jti)`; elimina cookie;
     responde 200
   - `GET /auth/me`: usa `JwtAuthGuard`; retorna datos del usuario actual desde el JWT payload;
     renueva token si está próximo a expirar (sliding window)
4. Configurar `cookie-parser` en `main.ts` del API.
5. Configurar `@nestjs/throttler` en `AppModule` para rate limiting por IP en `POST /auth/login`.
6. Integration tests: login exitoso → cookie set; login fallido → 401 genérico; brute-force → 429;
   logout → jti en blacklist → siguiente request 401; sliding window renewal.

### Fase D — Log de Auditoría

1. Verificar que existe el modelo `RegistroAuditoria` (spec 003) con campos: `accion`, `usuario_id`,
   `ip`, `timestamp`, `datos_nuevos`.
2. Implementar registro en `AuthController.login()`:
   - En cada intento (exitoso o fallido): INSERT en `registros_auditoria` con `accion =
     'LOGIN_EXITOSO' | 'LOGIN_FALLIDO'`, `ip` extraída del header `x-forwarded-for` o `req.ip`,
     `timestamp = NOW()`, `datos_nuevos = { email, motivo_fallo? }`.

### Fase E — Frontend: Página de Login y Protección de Rutas

1. Crear página `/login` con `LoginForm`:
   - MUI TextField para email y password
   - React Hook Form + Zod: validación client-side (email válido, password no vacío)
   - Submit → `POST /auth/login` via Axios
   - En respuesta: si `debeChangiarPassword = true` → redirigir a `/auth/cambiar-contrasena`;
     si false → redirigir al dashboard según rol o a la URL original (`returnUrl`)
   - En error 401: mostrar mensaje genérico "Credenciales inválidas"
   - En error 429: mostrar "Demasiados intentos. Cuenta bloqueada temporalmente."
   - En cuenta inactiva (401 con código específico): "Tu cuenta está inactiva. Contacta al administrador."
2. Implementar `middleware.ts` (Next.js Edge Middleware):
   - Si request a ruta protegida sin cookie `access_token`: redirigir a `/login?returnUrl=<url>`
   - Si request a `/login` con cookie activa: redirigir al dashboard
3. Implementar layout `(app)/layout.tsx`:
   - Llamar `GET /auth/me` en el servidor para verificar sesión activa
   - Si falla → redirigir a `/login`; si OK → renderizar con datos del usuario
4. Botón de logout en el layout:
   - `POST /auth/logout` via Axios → redirigir a `/login`
5. Mostrar `SessionExpiredBanner` cuando el redirect al login tiene `?reason=expired`.

## Complexity Tracking

| Decisión | Por qué necesaria | Alternativa rechazada |
|----------|------------------|-----------------------|
| JWT en HttpOnly cookie (no Authorization header) | Elimina vector XSS; SameSite=Strict previene CSRF | localStorage/sessionStorage: accesibles desde JS |
| Blacklist jti en memoria (no DB ni Redis) | Revocación inmediata sin dependencia de infraestructura adicional; ~10 usuarios concurrentes no justifican Redis | Redis/DB: overhead operacional desproporcionado para MVP |
| BruteForce en memoria (no Redis) | Ídem anterior; pérdida de contadores al reiniciar es aceptable | Redis para persistir contadores: misma justificación de overhead |
| Sliding window via re-emisión (no refresh token) | Evita el token de refresh separado y el tracking server-side de actividad | Refresh token: añade endpoint y rotación de secretos sin beneficio para MVP |
| debeChangiarPassword en JWT payload | Evita consulta adicional a DB en cada request para verificar el estado | Leer de DB en cada request: overhead innecesario cuando el estado ya está en el token |
