# Implementation Plan: Gestión de Cuentas de Usuario del Sistema

**Branch**: `009-create-system-user` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: `specs/009-create-system-user/spec.md`

## Summary

Implementar la pantalla de administración de cuentas de usuario del sistema: crear cuentas
con email, nombre, roles y contraseña inicial; vincular opcionalmente la cuenta a un
colaborador existente; editar roles (con invalidación inmediata de sesión activa); resetear
contraseña; y desactivar cuentas. Solo accesible para el rol ADMINISTRADOR.

## Technical Context

**Language/Version**: TypeScript / Node.js 20+

**Primary Dependencies**:
- Next.js 14 (App Router) — `apps/web`
- MUI v5 (Material UI 5.15) + Emotion 11 — UI
- `pg` Pool directo (sin Prisma en web app) — queries SQL
- `bcryptjs` — hashing de contraseñas (ya instalado en `apps/web/package.json`)
- `zod` — validación de input en API routes
- `jose` — verificación JWT (ya en `auth-server.ts`)
- Prisma + PostgreSQL — fuente de verdad del esquema; migration vía `packages/database`

**Storage**: PostgreSQL — tablas `usuarios`, `usuario_roles`, `colaboradores`, `registros_auditoria`

**Testing**: TypeScript (`tsc --noEmit`) — sin tests automatizados en MVP

**Target Platform**: Next.js web app (`apps/web`), misma arquitectura que features anteriores

**Performance Goals**: Operaciones admin CRUD < 500 ms p95

**Constraints**:
- Web app usa `pg` Pool directo (no Prisma) para todas las API routes
- Contraseñas hasheadas con `bcryptjs` (salt rounds 10, ya en uso en `/api/auth/login`)
- Invalidación de sesión activa via campo `roles_actualizados_en` en DB (ver §Data Model)
- No hay endpoints anónimos de escritura (Constitución §VIII)
- Audit trail obligatorio para toda escritura (Constitución §IX)

**Scale/Scope**: Equipo pequeño (< 50 cuentas). Admin-only. Sin paginación en MVP.

## Constitution Check

| Principio | Estado | Notas |
|---|---|---|
| I. Arquitectura Basada en Datos | ✅ CUMPLE | Modelo definido antes del desarrollo |
| II. Código Limpio / Modular | ✅ CUMPLE | Extensión modular; no toca código existente |
| III. Inmutabilidad Biométrica | ✅ N/A | No afecta eventos biométricos |
| IV. Cálculo Determinístico | ✅ N/A | No afecta liquidaciones |
| V. Reglas Configurables | ✅ N/A | No aplica |
| VI. Ciclo Semanal | ✅ N/A | No aplica |
| VII. Integración Biométrica | ✅ N/A | No aplica |
| VIII. RBAC | ✅ CUMPLE | Solo ADMINISTRADOR; `checkAdminRole` en todas las rutas |
| IX. Trazabilidad | ✅ CUMPLE | `registros_auditoria` en create, role-update, deactivate, reset |
| X. Asistencia Tiempo Real | ✅ N/A | No afecta dashboard |
| XI. Seguridad | ✅ CUMPLE | Contraseñas hasheadas; sesiones invalidadas al cambiar roles |

**Resultado**: Sin violaciones. Proceder.

## Data Model Amendments

El esquema Prisma v2.0 ya tiene la base (`usuario_roles`, `debe_cambiar_password`, 4 roles).
Se requieren dos columnas adicionales en `usuarios`:

### Columna 1: `colaborador_id` (FK opcional → `colaboradores`)

```sql
ALTER TABLE usuarios
  ADD COLUMN colaborador_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  ADD CONSTRAINT usuarios_colaborador_id_unique UNIQUE (colaborador_id);
```

Vínculo 1:1 opcional cuenta↔empleado. Cada colaborador puede tener a lo sumo una cuenta.

### Columna 2: `roles_actualizados_en` (timestamp para invalidación de sesión)

```sql
ALTER TABLE usuarios
  ADD COLUMN roles_actualizados_en TIMESTAMPTZ NULL;
```

Cuando el admin actualiza los roles, se setea a `NOW()`. El helper de auth compara
`payload.iat` con este timestamp: si `roles_actualizados_en > iat`, el token se rechaza
aunque sea criptográficamente válido, forzando re-login.

### Prisma Schema — añadir en `model Usuario`

```prisma
colaborador_id        String?   @unique @db.Uuid
roles_actualizados_en DateTime? @db.Timestamptz

colaborador Colaborador? @relation("UsuarioColaborador", fields: [colaborador_id], references: [id])
```

### Prisma Schema — añadir en `model Colaborador`

```prisma
usuario_sistema Usuario? @relation("UsuarioColaborador")
```

## Project Structure

### Documentation (this feature)

```text
specs/009-create-system-user/
├── plan.md              ← este archivo
├── data-model.md        ← generado abajo
├── contracts/
│   └── usuarios-api.md  ← generado abajo
└── tasks.md             ← generado por /speckit-tasks
```

### Source Code

```text
packages/database/prisma/
└── schema.prisma                              ← añadir colaborador_id + roles_actualizados_en

apps/web/src/
├── lib/
│   └── auth-server.ts                         ← añadir checkSessionValidity()
├── app/
│   ├── (app)/
│   │   └── usuarios/
│   │       └── page.tsx                       ← reemplazar ComingSoon
│   └── api/
│       └── usuarios/
│           ├── route.ts                       ← GET list, POST create
│           └── [id]/
│               ├── route.ts                   ← GET detail, PATCH nombre/apellido/colaborador
│               ├── roles/
│               │   └── route.ts               ← PUT reemplazar roles + invalidar sesión
│               ├── estado/
│               │   └── route.ts               ← PATCH activar/desactivar
│               └── reset-password/
│                   └── route.ts               ← POST resetear contraseña
└── components/
    └── usuarios/
        ├── UsuariosListClient.tsx             ← lista + búsqueda + acciones
        ├── CrearUsuarioDialog.tsx             ← formulario creación + display password
        ├── EditarUsuarioDialog.tsx            ← editar nombre, roles, vínculo colaborador
        └── ResetPasswordDialog.tsx            ← ingresar nueva pass + display una vez
```

## Session Invalidation

Nueva función en `auth-server.ts`:

```ts
export async function checkSessionValidity(userId: string, iat: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT roles_actualizados_en FROM usuarios WHERE id = $1 AND activo = true`,
      [userId],
    );
    if (res.rows.length === 0) return false;
    const ts: Date | null = res.rows[0].roles_actualizados_en;
    if (!ts) return true;
    return iat * 1000 > ts.getTime(); // iat viene en segundos
  } finally {
    client.release();
  }
}
```

`checkAdminRole` llama a `checkSessionValidity(payload.sub, payload.iat)` tras verificar
el JWT. Devuelve 401 si la sesión fue invalidada.

## Password Display — UX Pattern

Tras crear cuenta o hacer reset, el API devuelve `{ ok: true }` — nunca retorna la
contraseña. El frontend muestra la contraseña que el admin ingresó en el formulario en un
modal de confirmación con:
- La contraseña en texto visible + botón copiar al portapapeles
- Aviso: "Esta contraseña no se mostrará nuevamente."
- El campo de contraseña del formulario se limpia al cerrar el modal.

## Complexity Tracking

Sin violaciones de Constitución que justificar.
