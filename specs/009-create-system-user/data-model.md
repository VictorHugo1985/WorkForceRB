# Data Model: Gestión de Cuentas de Usuario del Sistema

**Feature**: 009-create-system-user | **Date**: 2026-06-18

## Entidades Afectadas

### `usuarios` (existente — enmienda)

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `id` | UUID | PK, gen_random_uuid() | Identificador único |
| `email` | VARCHAR | UNIQUE NOT NULL | Identificador de login; inmutable |
| `password_hash` | VARCHAR | NOT NULL | Hash bcrypt; nunca plaintext |
| `nombre` | VARCHAR | NOT NULL | Nombre del usuario |
| `apellido` | VARCHAR | NOT NULL | Apellido del usuario |
| `debe_cambiar_password` | BOOLEAN | DEFAULT false | Flag primer-acceso y reset |
| `activo` | BOOLEAN | DEFAULT true | Cuentas no se eliminan, solo desactivan |
| `email_verificado` | BOOLEAN | DEFAULT false | Reservado para uso futuro |
| `ultimo_acceso` | TIMESTAMPTZ | NULL | Actualizado en login |
| `colaborador_id` | UUID | FK→colaboradores, UNIQUE, NULL | **[NEW]** Vínculo 1:1 opcional |
| `roles_actualizados_en` | TIMESTAMPTZ | NULL | **[NEW]** Timestamp para invalidar sesiones |
| `creado_en` | TIMESTAMPTZ | DEFAULT NOW() | |
| `actualizado_en` | TIMESTAMPTZ | auto-update | |

**Migraciones SQL**:
```sql
ALTER TABLE usuarios
  ADD COLUMN colaborador_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  ADD CONSTRAINT usuarios_colaborador_id_unique UNIQUE (colaborador_id),
  ADD COLUMN roles_actualizados_en TIMESTAMPTZ NULL;
```

---

### `usuario_roles` (existente — sin cambios)

| Campo | Tipo | Constraint | Descripción |
|---|---|---|---|
| `usuario_id` | UUID | PK, FK→usuarios CASCADE | |
| `rol` | ENUM | PK, {ADMINISTRADOR, SUPERVISOR, CAJERO, COLABORADOR} | |

Relación M:N entre usuarios y roles. Un usuario puede tener múltiples roles simultáneos.

---

### `colaboradores` (existente — referenciada)

No se modifica la tabla. La FK vive en `usuarios.colaborador_id`.

---

### `registros_auditoria` (existente — append-only)

Registros generados por esta feature:

| `accion` | `entidad_tipo` | Cuándo |
|---|---|---|
| `USUARIO_CREADO` | `Usuario` | Al crear cuenta |
| `USUARIO_ROLES_ACTUALIZADOS` | `Usuario` | Al cambiar roles |
| `USUARIO_DESACTIVADO` | `Usuario` | Al desactivar |
| `USUARIO_ACTIVADO` | `Usuario` | Al reactivar |
| `USUARIO_PASSWORD_RESETEADA` | `Usuario` | Al resetear contraseña |

---

## Reglas de Negocio / Constraints

1. **Email único e inmutable**: una vez creado, el email no puede modificarse.
2. **Al menos un rol**: un usuario debe tener ≥ 1 rol en todo momento.
3. **Mínimo un ADMINISTRADOR activo**: el sistema rechaza el último intento de:
   - Quitar el rol ADMINISTRADOR si el usuario es el único admin activo.
   - Desactivar la última cuenta con rol ADMINISTRADOR.
4. **Colaborador vinculado a una sola cuenta**: constraint UNIQUE en `usuarios.colaborador_id`.
5. **Contraseña nunca plaintext**: `password_hash` almacena solo el hash bcrypt (rounds=10).
6. **`debe_cambiar_password = true`** se setea en: creación de cuenta y reset de contraseña.
7. **`roles_actualizados_en = NOW()`** se setea cada vez que se modifican los roles.

## State Transitions

### Cuenta de Usuario

```
[CREATE] → activo=true, debe_cambiar_password=true
   │
   ├─ [PATCH /estado activo=false] → activo=false (sesión activa invalidad por blacklist/flag)
   └─ [PATCH /estado activo=true]  → activo=true  (reactivación)

[PUT /roles] → roles reemplazados + roles_actualizados_en=NOW()
[POST /reset-password] → password_hash actualizado + debe_cambiar_password=true
```
