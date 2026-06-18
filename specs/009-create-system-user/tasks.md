# Tasks: Gestión de Cuentas de Usuario del Sistema

**Input**: Design documents from `specs/009-create-system-user/`

**Feature**: 009-create-system-user | spec.md · plan.md · data-model.md · contracts/usuarios-api.md

**No tests**: MVP — validación vía TypeScript check y prueba manual.

---

## Phase 1: Setup (Migración de Base de Datos)

**Purpose**: Aplicar los cambios al modelo de datos antes de cualquier código de aplicación.

- [X] T001 Update Prisma schema: add `colaborador_id UUID? @unique @db.Uuid` and `roles_actualizados_en DateTime? @db.Timestamptz` to model `Usuario`; add back-relation `usuario_sistema Usuario?` to model `Colaborador` in `packages/database/prisma/schema.prisma`
- [X] T002 Generate and apply DB migration: run `cd packages/database && npx prisma migrate dev --name add_user_account_fields` to create migration file and push `ALTER TABLE usuarios ADD COLUMN colaborador_id ... ADD COLUMN roles_actualizados_en ...`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura compartida requerida por todas las API routes de esta feature.

**⚠️ CRITICAL**: No user story work puede comenzar hasta completar esta fase.

- [X] T003 Add `checkSessionValidity(userId: string, iat: number): Promise<boolean>` function to `apps/web/src/lib/auth-server.ts`; update `checkAdminRole` to call `checkSessionValidity(payload.sub, payload.iat)` after JWT verification and return 401 if session is invalid (roles changed after token was issued)

**Checkpoint**: Auth helper actualizado — las rutas API pueden invalidar sesiones al cambiar roles.

---

## Phase 3: User Story 1 — Crear Cuenta de Acceso con Rol(es) (Priority: P1) 🎯 MVP

**Goal**: Admin crea una cuenta con nombre, email, password y al menos un rol. La contraseña se muestra una sola vez al guardar.

**Independent Test**: Crear cuenta para "María González" con rol SUPERVISOR y contraseña inicial. Iniciar sesión con esas credenciales y verificar que redirige a cambio de contraseña (debe_cambiar_password=true).

- [X] T004 [P] [US1] Implement `GET /api/usuarios` (returns list with roles, activo, creado_en) and `POST /api/usuarios` (validates fields, hashes password with bcryptjs rounds=10, inserts usuario + usuario_roles + audit log, sets debe_cambiar_password=true) in `apps/web/src/app/api/usuarios/route.ts`
- [X] T005 [P] [US1] Implement `UsuariosListClient.tsx` — MUI Table showing nombre+apellido, email, roles Chips, activo/inactivo Badge, creado_en; accept `isAdmin: boolean` and `onRefresh: () => void` props in `apps/web/src/components/usuarios/UsuariosListClient.tsx`
- [X] T006 [P] [US1] Implement `CrearUsuarioDialog.tsx` — MUI Dialog with form fields (nombre, apellido, email, password with policy hint, roles CheckboxGroup); on success show one-time password modal with copy-to-clipboard button and warning "Esta contraseña no se mostrará nuevamente"; call `onCreado()` on close in `apps/web/src/components/usuarios/CrearUsuarioDialog.tsx`
- [X] T007 [US1] Replace ComingSoon with server page in `apps/web/src/app/(app)/usuarios/page.tsx` — verify ADMINISTRADOR role, fetch usuarios with roles from DB (direct pg pool), render `UsuariosListClient` with `isAdmin={true}` and "Nuevo Usuario" button that opens `CrearUsuarioDialog` (depends on T004, T005, T006)

**Checkpoint**: Admin puede crear cuentas y el nuevo usuario puede iniciar sesión.

---

## Phase 4: User Story 2 — Vincular Cuenta a Registro de Colaborador (Priority: P2)

**Goal**: Al crear o editar una cuenta, el admin puede vincularla a un colaborador existente. El vínculo es 1:1 y opcional.

**Independent Test**: Crear cuenta para "Carlos Méndez" y vincularla a su ficha de colaborador. Verificar que el colaborador no aparece disponible para vincular en otras cuentas nuevas.

- [X] T008 [P] [US2] Add `GET /api/usuarios/colaboradores-disponibles` route — returns active colaboradores (id, nombre, apellido, cedula) whose id is NOT already in `usuarios.colaborador_id`; requires ADMINISTRADOR in `apps/web/src/app/api/usuarios/colaboradores-disponibles/route.ts`
- [X] T009 [P] [US2] Implement `GET /api/usuarios/[id]` (detail) and `PATCH /api/usuarios/[id]` (update nombre, apellido, colaborador_id with unique-link guard) in `apps/web/src/app/api/usuarios/[id]/route.ts`
- [X] T010 [P] [US2] Add colaborador Autocomplete selector to `CrearUsuarioDialog.tsx` — loads from `/api/usuarios/colaboradores-disponibles` on open; shows "nombre apellido (cédula)" as options; clears on form reset in `apps/web/src/components/usuarios/CrearUsuarioDialog.tsx` (depends on T008)
- [X] T011 [P] [US2] Implement `EditarUsuarioDialog.tsx` — MUI Dialog with fields: nombre, apellido, colaborador Autocomplete selector; calls `PATCH /api/usuarios/[id]` on save in `apps/web/src/components/usuarios/EditarUsuarioDialog.tsx` (depends on T008, T009)
- [X] T012 [US2] Add "Editar" IconButton per row in `UsuariosListClient.tsx` — opens `EditarUsuarioDialog` with selected user; calls `onRefresh()` on save success in `apps/web/src/components/usuarios/UsuariosListClient.tsx` (depends on T011)

**Checkpoint**: Admin puede crear y editar cuentas con vínculo a colaborador.

---

## Phase 5: User Story 3 — Gestionar Cuentas Existentes (Priority: P3)

**Goal**: Admin puede editar roles (con invalidación inmediata de sesión), desactivar/activar cuentas, y resetear contraseñas. Lista filtrable por nombre o email.

**Independent Test**: (a) Cambiar roles de un usuario activo — su sesión se invalida y debe re-loguear. (b) Desactivar la única cuenta ADMINISTRADOR — el sistema rechaza con 422. (c) Resetear contraseña — la nueva contraseña se muestra una vez y el usuario debe cambiarla al siguiente login.

- [X] T013 [P] [US3] Implement `PUT /api/usuarios/[id]/roles` route — validates non-empty roles array, guard against removing last ADMINISTRADOR (query `SELECT COUNT(*) FROM usuarios u JOIN usuario_roles ur ... WHERE ur.rol='ADMINISTRADOR' AND u.activo=true AND u.id != $1`), delete+insert usuario_roles in transaction, set `roles_actualizados_en=NOW()`, audit log in `apps/web/src/app/api/usuarios/[id]/roles/route.ts`
- [X] T014 [P] [US3] Implement `PATCH /api/usuarios/[id]/estado` route — guard against deactivating last ADMINISTRADOR, update `usuarios.activo`, audit log in `apps/web/src/app/api/usuarios/[id]/estado/route.ts`
- [X] T015 [P] [US3] Implement `POST /api/usuarios/[id]/reset-password` route — validates password policy (≥8 chars, uppercase, lowercase, digit), rejects if user is inactive (422), hashes with bcryptjs, updates `password_hash` and sets `debe_cambiar_password=true`, audit log in `apps/web/src/app/api/usuarios/[id]/reset-password/route.ts`
- [X] T016 [P] [US3] Implement `ResetPasswordDialog.tsx` — MUI Dialog with password TextField + policy hint; on save shows one-time display modal with copy-to-clipboard; calls `onReset()` on close in `apps/web/src/components/usuarios/ResetPasswordDialog.tsx`
- [X] T017 [US3] Add roles editing section to `EditarUsuarioDialog.tsx` — CheckboxGroup for all 4 roles, save via `PUT /api/usuarios/[id]/roles`, show warning "El usuario deberá volver a iniciar sesión" in `apps/web/src/components/usuarios/EditarUsuarioDialog.tsx` (depends on T013)
- [X] T018 [US3] Add action buttons per row in `UsuariosListClient.tsx` — toggle activo/inactivo (calls PATCH /estado), open ResetPasswordDialog; disable deactivate if user is last admin in `apps/web/src/components/usuarios/UsuariosListClient.tsx` (depends on T014, T015, T016)
- [X] T019 [US3] Add client-side search TextField above table in `UsuariosListClient.tsx` — filters displayed rows by nombre+apellido or email (case-insensitive substring match) in `apps/web/src/components/usuarios/UsuariosListClient.tsx`

**Checkpoint**: Gestión completa de cuentas funcionando.

---

## Phase 6: Polish

- [X] T020 Run TypeScript check `npx tsc --noEmit` in `apps/web` and fix all type errors in new files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar aquí
- **Foundational (Phase 2)**: Depende de Phase 1 — **bloquea todas las user stories**
- **US1 (Phase 3)**: Depende de Phase 2 — puede comenzar inmediatamente después
- **US2 (Phase 4)**: Depende de Phase 2 y T007 (la página base de US1 debe existir)
- **US3 (Phase 5)**: Depende de Phase 2 y T011/T012 (diálogo de edición debe existir para añadir la sección de roles)
- **Polish (Phase 6)**: Depende de todas las fases anteriores

### Within Each User Story

- T004, T005, T006 [P] pueden ejecutarse en paralelo (archivos distintos)
- T007 depende de T004+T005+T006
- T008, T009, T010, T011 [P] pueden ejecutarse en paralelo
- T012 depende de T011
- T013, T014, T015, T016 [P] pueden ejecutarse en paralelo
- T017 depende de T013; T018 depende de T014+T015+T016

---

## Parallel Execution Examples

### Phase 3 (US1)
```text
Parallel: T004 (API route), T005 (list component), T006 (create dialog)
Then sequential: T007 (server page, wires everything together)
```

### Phase 4 (US2)
```text
Parallel: T008 (colaboradores-disponibles API), T009 (PATCH user API), T011 (EditarDialog skeleton)
Then: T010 (add selector to CrearDialog), T011 extended, T012 (wire edit button)
```

### Phase 5 (US3)
```text
Parallel: T013 (roles API), T014 (estado API), T015 (reset-password API), T016 (ResetDialog)
Then: T017 (roles section in EditarDialog), T018 (wire action buttons), T019 (search)
```

---

## Implementation Strategy

### MVP (Phase 1 + 2 + Phase 3 solamente)

1. Completar migración DB (T001, T002)
2. Agregar `checkSessionValidity` (T003)
3. Implementar API GET+POST + componentes (T004, T005, T006 en paralelo)
4. Conectar página servidor (T007)
5. **VALIDAR**: crear cuenta, iniciar sesión, verificar redirección a primer acceso

### Entrega Incremental

1. MVP (US1) → el admin puede crear cuentas básicas
2. Añadir US2 → el admin puede vincular cuentas a colaboradores
3. Añadir US3 → gestión completa: roles, estado, reset de contraseña, búsqueda
4. Polish → TypeScript clean

---

## Notes

- Todas las rutas API usan `checkAdminRole(req)` de `apps/web/src/lib/auth-server.ts`
- `checkAdminRole` llama `checkSessionValidity` (T003) — las rutas están protegidas sin código adicional
- `bcryptjs` ya está instalado en `apps/web` — importar con `import bcrypt from 'bcryptjs'`
- La contraseña nunca viaja del backend al frontend tras guardar — el frontend la muestra desde el estado del formulario
- Audit logs van a `registros_auditoria` con `usuario_id = auth.userId` del token
- La página `/usuarios` ya está en `nav-config.ts` con guard `ADMINISTRADOR` — no requiere cambios en sidebar
