# API Contracts: Autenticación de Usuarios (Login / Logout)

**Feature**: 005-user-login | **Date**: 2026-05-23

---

## POST /auth/login

**Descripción**: Autenticar usuario con correo y contraseña. Si las credenciales son válidas y la
cuenta está activa, emite un JWT en cookie HttpOnly y retorna datos del usuario.

**Auth requerida**: No (endpoint público)

**Rate limiting**: `@nestjs/throttler` por IP + `BruteForceService` por email (5 intentos → 15 min lockout)

### Request

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña-del-usuario"
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `email` | `string` | Sí | Email válido, maxLength 254 |
| `password` | `string` | Sí | No vacío, maxLength 128 |

### Responses

**200 OK — Login exitoso**

Cookie establecida: `access_token=<JWT>; HttpOnly; Secure; SameSite=Strict; Path=/`

```json
{
  "nombre": "Ana García",
  "roles": ["ADMINISTRADOR"],
  "debeChangiarPassword": false
}
```

**200 OK — Login exitoso con cambio de contraseña obligatorio**

Cookie establecida (ídem)

```json
{
  "nombre": "Carlos Pérez",
  "roles": ["CAJERO"],
  "debeChangiarPassword": true
}
```

*El frontend DEBE redirigir a `/auth/cambiar-contrasena` cuando `debeChangiarPassword = true`.*

**401 Unauthorized — Credenciales inválidas o cuenta inactiva**

```json
{
  "statusCode": 401,
  "message": "Credenciales inválidas o cuenta inactiva",
  "error": "Unauthorized"
}
```

*Mensaje idéntico para email inexistente, contraseña incorrecta y cuenta desactivada (no revelar cuál campo falló — FR-004).*

**429 Too Many Requests — Cuenta bloqueada por brute-force**

```json
{
  "statusCode": 429,
  "message": "Demasiados intentos fallidos. Intente nuevamente en 15 minutos.",
  "error": "Too Many Requests",
  "retryAfterSeconds": 720
}
```

---

## POST /auth/logout

**Descripción**: Cerrar la sesión activa. Agrega el `jti` del JWT actual al blacklist en memoria
y elimina la cookie del navegador.

**Auth requerida**: Sí (`JwtAuthGuard`)

### Request

```http
POST /auth/logout
Cookie: access_token=<JWT>
```

Sin body.

### Responses

**200 OK — Logout exitoso**

Cookie eliminada: `Set-Cookie: access_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

```json
{
  "message": "Sesión cerrada correctamente"
}
```

**401 Unauthorized — Sesión no activa o token inválido**

```json
{
  "statusCode": 401,
  "message": "No autenticado",
  "error": "Unauthorized"
}
```

---

## GET /auth/me

**Descripción**: Retorna los datos del usuario autenticado desde el JWT payload. Si el token tiene
menos de 1h de vida restante, se re-emite automáticamente (sliding window — Decision 2).

**Auth requerida**: Sí (`JwtAuthGuard`)

### Request

```http
GET /auth/me
Cookie: access_token=<JWT>
```

Sin body.

### Responses

**200 OK**

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "ana.garcia@empresa.com",
  "nombre": "Ana García",
  "roles": ["ADMINISTRADOR"],
  "debeChangiarPassword": false
}
```

Si el token fue renovado (sliding window), la respuesta incluye una nueva cookie `access_token`
con `exp = now + 2h`.

**401 Unauthorized — Token expirado o inválido**

```json
{
  "statusCode": 401,
  "message": "Sesión expirada o no válida",
  "error": "Unauthorized"
}
```

*El frontend DEBE redirigir a `/login?reason=expired` al recibir 401 en `GET /auth/me`.*

---

## JWT Payload (referencia interna)

No expuesto como endpoint; documentado para implementadores.

```typescript
interface JwtPayload {
  sub: string;                   // usuarios.id (UUID)
  email: string;
  nombre: string;
  roles: RolUsuario[];           // array de roles del usuario
  debeChangiarPassword: boolean; // flag de primer acceso
  jti: string;                   // UUID único por emisión (para blacklist)
  iat: number;                   // Unix timestamp — emisión
  exp: number;                   // Unix timestamp — expiración (now + 7200s)
}
```

---

## Comportamiento de la Cookie

| Atributo | Valor |
|----------|-------|
| Nombre | `access_token` |
| `HttpOnly` | Sí (inaccesible desde JS) |
| `Secure` | Sí (solo HTTPS) |
| `SameSite` | `Strict` |
| `Path` | `/` |
| `Max-Age` | No establecido (cookie de sesión — expira al cerrar el navegador) |

---

## Auditoría (registro interno, no expuesto en API)

Por cada intento de login (exitoso o fallido) se inserta en `registros_auditoria`:

| Campo | Valor |
|-------|-------|
| `accion` | `LOGIN_EXITOSO` \| `LOGIN_FALLIDO` |
| `usuario_id` | UUID del usuario si existe; `null` si el correo no se encontró |
| `ip` | IP de origen (`x-forwarded-for` o `req.ip`) |
| `timestamp` | `NOW()` |
| `datos_nuevos` | `{ email, motivo_fallo? }` |
