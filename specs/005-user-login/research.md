# Research: Autenticación de Usuarios (Login / Logout)

**Feature**: 005-user-login | **Date**: 2026-05-23

---

## Decision 1: Token en HttpOnly cookie (no Authorization header)

**Decision**: JWT almacenado en cookie HttpOnly, Secure, SameSite=Strict — no en `localStorage` ni en header `Authorization`.

**Rationale**: HttpOnly cookie es inaccesible desde JavaScript, eliminando el vector de ataque XSS. SameSite=Strict previene CSRF en navegadores modernos. Es el patrón aprobado en la constitución ("cookies HttpOnly").

**Alternatives considered**:
- localStorage + Authorization header: rechazado — vulnerable a XSS; cualquier script inyectado puede robar el token.
- sessionStorage: rechazado — también accesible desde JS y no sobrevive a tabs de la misma sesión de forma consistente.

---

## Decision 2: Ventana deslizante de inactividad (re-emisión de JWT por solicitud)

**Decision**: El backend re-emite el JWT (con nueva expiración = `now + 2h`) en cada solicitud autenticada exitosa. Si el token tiene menos de 1h de vida restante, el backend pone una nueva cookie `Set-Cookie` en la respuesta. Si el token ha expirado, la solicitud falla y el frontend redirige al login.

**Rationale**: Implementa la ventana deslizante de 2h de inactividad sin necesidad de un refresh token separado ni de tracking server-side de `ultimo_acceso` para este propósito. La lógica es: "si usás el sistema, la sesión se extiende automáticamente; si no lo usás durante 2h, expira."

**Alternatives considered**:
- Refresh token separado: más robusto pero añade complejidad innecesaria para MVP con ~10 usuarios.
- Tracking `ultimo_acceso` en DB y verificación server-side: requiere lectura a DB en cada request — overhead innecesario.
- JWT de vida fija sin renovación: produce expiración abrupta aunque el usuario esté activo — mala UX.

---

## Decision 3: Revocación de sesión en logout (jti blacklist en memoria)

**Decision**: Al emitir cada JWT, se incluye un campo `jti` (UUID único). Al hacer logout, el `jti` se agrega a un `Set<string>` en memoria del proceso NestJS. Cada JWT validation verifica que el `jti` no esté en el blacklist. El blacklist se limpia automáticamente al reiniciar el proceso (aceptable para MVP).

**Rationale**: Permite logout inmediato sin necesidad de Redis ni tabla en DB. Para una app interna con ~10 usuarios simultáneos y reinicio de proceso poco frecuente, el riesgo de perder el blacklist es aceptable.

**Alternatives considered**:
- Redis blacklist: más robusto (sobrevive reinicios) pero añade una dependencia de infraestructura no justificada para MVP.
- DB table `sesiones_revocadas`: persiste entre reinicios pero añade una lectura a DB en cada request — overhead mayor que la alternativa en memoria.
- Sin revocación (logout solo limpia cookie en cliente): rechazado porque el spec exige "la sesión queda invalidada de forma inmediata" (FR-006) — la cookie podría reutilizarse si fue robada.

---

## Decision 4: Estrategias Passport (local + JWT)

**Decision**: Dos estrategias Passport:
- `passport-local` (`LocalStrategy`): valida email + contraseña en `POST /auth/login`. Usa `bcrypt.compare()` para verificar el hash.
- `passport-jwt` (`JwtStrategy`): extrae JWT de la cookie HttpOnly en todas las rutas protegidas. Verifica firma + expiración + jti no revocado.

**Rationale**: Passport es el estándar de autenticación en NestJS (incluso listado en la constitución). La separación en dos estrategias mantiene el SRP: una estrategia por "momento" del ciclo de vida de la sesión.

**Alternatives considered**:
- Implementación manual sin Passport: añade boilerplate sin beneficio — Passport ya está en el stack.
- Solo passport-local sin JWT: requeriría sesiones stateful en DB — más complejo para invalidación.

---

## Decision 5: Protección anti fuerza bruta — servicio en memoria

**Decision**: `BruteForceService` — `Map<email, { attempts: number, lockedUntil: Date | null }>` gestionado en memoria del proceso. Lógica:
- Incrementar contador en cada intento fallido
- Al llegar a 5 intentos → `lockedUntil = now + 15min`
- Resetear contador tras login exitoso o tras expiración del lockout
- `@nestjs/throttler` se usa para rate limiting por IP (capa adicional), pero el conteo por email es responsabilidad de `BruteForceService`

**Rationale**: `@nestjs/throttler` ya incluido en el stack. BruteForceService en memoria es suficiente para MVP (los lockouts se pierden al reiniciar el proceso, pero eso es aceptable — en todo caso el usuario puede intentar después).

**Alternatives considered**:
- Solo @nestjs/throttler (por IP): insuficiente — la spec exige bloqueo por correo, no por IP; un atacante desde múltiples IPs burlaría el throttle.
- Redis para contadores: robusto y distribuido, pero innecesario para MVP monoproceso.

---

## Decision 6: `debe_cambiar_password` en JWT payload + restricción de sesión

**Decision**: El JWT payload incluye `debeChangiarPassword: boolean`. Cuando es `true`:
1. El backend en `POST /auth/login` responde 200 con la cookie JWT normal PERO incluye `debeChangiarPassword: true` en el response body.
2. El frontend (y el middleware de spec 010) detecta este flag y redirige a `/auth/cambiar-contrasena`.
3. El guard JWT (`JwtAuthGuard`) bloquea todas las rutas excepto `/auth/cambiar-contrasena` y `/auth/logout` cuando `debeChangiarPassword = true` en el payload.
4. Tras el cambio exitoso, el backend actualiza `debe_cambiar_password = false`, emite un nuevo JWT sin el flag y redirige al dashboard.

**Rationale**: Incluir el flag en el JWT evita una consulta adicional a DB en cada request para verificar el estado. El guard garantiza que una sesión restringida no pueda acceder a rutas no autorizadas incluso si el frontend falla en redirigir.

**Alternatives considered**:
- HTTP 307 Redirect desde POST /auth/login: no compatible con AJAX/fetch desde el frontend; el cliente no sigue redirects automáticamente en POST requests.
- Verificar `debe_cambiar_password` en DB en cada request: overhead innecesario — el JWT ya contiene el estado.
