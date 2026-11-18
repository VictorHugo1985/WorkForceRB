# API Contract: Gestión de Usuarios del Sistema

**Feature**: 009-create-system-user | **Date**: 2026-06-18

Auth requerida en todos los endpoints: cookie `access_token` con rol `ADMINISTRADOR`.

---

## `GET /api/usuarios`

Lista todos los usuarios del sistema.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "nombre": "María",
    "apellido": "González",
    "email": "maria@empresa.com",
    "roles": ["SUPERVISOR", "CAJERO"],
    "activo": true,
    "colaborador_id": "uuid-or-null",
    "colaborador_nombre": "María González",
    "creado_en": "2026-06-18T10:00:00Z"
  }
]
```

---

## `POST /api/usuarios`

Crea una nueva cuenta de usuario.

**Request Body**:
```json
{
  "nombre": "string",
  "apellido": "string",
  "email": "string (email válido, único)",
  "roles": ["ADMINISTRADOR|SUPERVISOR|CAJERO|COLABORADOR"],
  "password": "string (≥8 chars, 1 mayúscula, 1 minúscula, 1 dígito)",
  "colaborador_id": "uuid | null"
}
```

**Response 201**:
```json
{
  "id": "uuid",
  "nombre": "string",
  "apellido": "string",
  "email": "string",
  "roles": ["string"],
  "activo": true,
  "colaborador_id": "uuid | null",
  "creado_en": "ISO8601"
}
```

**Errores**:
- `400` — campo requerido faltante | email inválido | política de contraseña no cumplida | roles vacío
- `409` — email ya registrado | colaborador_id ya vinculado a otra cuenta

---

## `GET /api/usuarios/[id]`

Detalle de un usuario.

**Response 200**: mismo shape que ítem del GET list, más `ultimo_acceso`.

**Errores**:
- `404` — usuario no encontrado

---

## `PATCH /api/usuarios/[id]`

Edita nombre, apellido y/o vínculo con colaborador.

**Request Body** (todos opcionales):
```json
{
  "nombre": "string",
  "apellido": "string",
  "colaborador_id": "uuid | null"
}
```

**Response 200**: objeto usuario actualizado.

**Errores**:
- `404` — usuario no encontrado
- `409` — colaborador_id ya vinculado a otra cuenta

---

## `PUT /api/usuarios/[id]/roles`

Reemplaza el conjunto completo de roles del usuario.

**Request Body**:
```json
{
  "roles": ["SUPERVISOR", "CAJERO"]
}
```

**Efecto colateral**: `roles_actualizados_en = NOW()` — invalida sesión activa del usuario.

**Response 200**:
```json
{ "id": "uuid", "roles": ["SUPERVISOR", "CAJERO"] }
```

**Errores**:
- `400` — roles vacío | valor de rol inválido
- `404` — usuario no encontrado
- `422` — operación resultaría en 0 administradores activos

---

## `PATCH /api/usuarios/[id]/estado`

Activa o desactiva la cuenta.

**Request Body**:
```json
{ "activo": false }
```

**Response 200**:
```json
{ "id": "uuid", "activo": false }
```

**Errores**:
- `404` — usuario no encontrado
- `422` — intento de desactivar el último ADMINISTRADOR activo

---

## `POST /api/usuarios/[id]/reset-password`

Resetea la contraseña de cualquier cuenta activa.

**Request Body**:
```json
{ "password": "NuevaPass123" }
```

**Efecto**: hashea y almacena nueva contraseña + `debe_cambiar_password = true`.

**Response 200**:
```json
{ "ok": true }
```

La contraseña nunca se retorna en la respuesta. El frontend la muestra desde el estado local del formulario.

**Errores**:
- `400` — política de contraseña no cumplida
- `404` — usuario no encontrado
- `422` — cuenta inactiva (no se resetea password de cuentas desactivadas)
