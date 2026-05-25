# Data Model: Autenticación de Usuarios (Login / Logout)

**Feature**: 005-user-login | **Date**: 2026-05-23
**Base model**: specs/003-mvp-data-model/data-model.md

---

## Resumen de Enmiendas al Modelo Base (spec 003)

Esta feature requiere **dos enmiendas** al modelo de datos existente:

| Enmienda | Entidad | Tipo de cambio |
|----------|---------|----------------|
| 1 | `usuarios` | Añadir columna `debe_cambiar_password BOOLEAN NOT NULL DEFAULT false` |
| 2 | `usuarios` + nueva tabla | Reemplazar `rol` (enum único) por relación M:N `usuario_roles` con enum `RolUsuario` expandido *(comparte enmienda con spec 009)* |

> **Nota**: La enmienda 2 es compartida con spec 009 (creación de usuarios). Debe coordinarse para evitar migraciones conflictivas. Spec 005 la documenta aquí como dependencia; spec 009 puede liderar la migración.

---

## Enmienda 1 — Tabla `usuarios` (nueva columna)

| Campo | Tipo DB | Prisma | Nullable | Único | Default | Descripción |
|-------|---------|--------|----------|-------|---------|-------------|
| `debe_cambiar_password` | `BOOLEAN` | `Boolean` | No | No | `false` | `true` = la cuenta fue creada con contraseña inicial y el usuario aún no la cambió. Forzado en primer login (spec 009 FR-005). |

```prisma
model Usuario {
  // ... campos existentes ...
  debe_cambiar_password  Boolean  @default(false)
}
```

---

## Enmienda 2 — Multi-rol: de `rol` (enum único) a `usuario_roles` (M:N)

El modelo base (spec 003) define `rol` como un enum único en `usuarios`. Spec 009 (FR-003) requiere múltiples roles por usuario. Esta enmienda reemplaza el campo único por una relación M:N.

### Cambio en `usuarios`

Eliminar campo `rol`. Mantener todo lo demás igual.

### Nuevo enum `RolUsuario`

```prisma
enum RolUsuario {
  ADMINISTRADOR
  SUPERVISOR
  CAJERO      // NEW — spec 009
  COLABORADOR // NEW — spec 009
}
```

### Nueva tabla `usuario_roles`

| Campo | Tipo DB | Prisma | Nullable | Único | Default | Descripción |
|-------|---------|--------|----------|-------|---------|-------------|
| `usuario_id` | `UUID` | `String @db.Uuid` | No | No (PK compuesta) | — | FK → `usuarios.id` |
| `rol` | `RolUsuario` | `RolUsuario` | No | No (PK compuesta) | — | Rol asignado |

**Constraint**: `PRIMARY KEY (usuario_id, rol)` — un usuario no puede tener el mismo rol dos veces.

```prisma
model UsuarioRol {
  usuario_id  String      @db.Uuid
  rol         RolUsuario
  usuario     Usuario     @relation(fields: [usuario_id], references: [id])

  @@id([usuario_id, rol])
  @@map("usuario_roles")
}

model Usuario {
  // ...
  roles  UsuarioRol[]
}
```

---

## JWT Payload

El token JWT emitido tras login exitoso incluye:

```typescript
interface JwtPayload {
  sub: string;                    // usuarios.id (UUID)
  email: string;
  nombre: string;
  roles: RolUsuario[];            // array de roles asignados
  debeChangiarPassword: boolean;  // usuarios.debe_cambiar_password
  jti: string;                    // UUID único por emisión (para revocación)
  iat: number;                    // issued at (Unix timestamp)
  exp: number;                    // expiry = now + 2h (sliding, renovado en cada request)
}
```

---

## BruteForce State (en memoria — no persiste en DB)

```typescript
interface BruteForceEntry {
  attempts: number;         // Intentos fallidos consecutivos
  lockedUntil: Date | null; // null = no bloqueado; Date = bloqueado hasta esta fecha
}
// Map<email, BruteForceEntry>
```

Reinicios del proceso limpian este mapa (aceptable para MVP). No requiere migración de DB.

---

## Consultas clave

### Validar credenciales (LocalStrategy)
```sql
SELECT u.id, u.email, u.nombre, u.apellido, u.password_hash,
       u.activo, u.debe_cambiar_password,
       array_agg(ur.rol) as roles
FROM usuarios u
LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
WHERE u.email = :email
GROUP BY u.id;
```

### Actualizar ultimo_acceso tras login exitoso
```sql
UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = :id;
```

### Marcar contraseña cambiada (post primer login)
```sql
UPDATE usuarios SET debe_cambiar_password = FALSE WHERE id = :id;
```
