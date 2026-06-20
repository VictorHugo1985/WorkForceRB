# API Contract: Accesos

**Feature**: 023-login-audit-log | **Date**: 2026-06-20

## GET /api/accesos

Devuelve el historial paginado de intentos de inicio de sesión.

**Autenticación**: Cookie `access_token` con rol `ADMINISTRADOR`.

### Query Parameters

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `usuario_id` | UUID | — | Filtrar por usuario específico |
| `resultado` | `exitoso` \| `fallido` | — | Filtrar por resultado |
| `desde` | ISO 8601 (`YYYY-MM-DD`) | — | Fecha inicio del rango (inclusiva) |
| `hasta` | ISO 8601 (`YYYY-MM-DD`) | — | Fecha fin del rango (inclusiva, hasta 23:59:59) |
| `page` | integer ≥ 1 | `1` | Página actual |
| `limit` | integer 1–200 | `50` | Registros por página |

### Response 200

```json
{
  "total": 143,
  "page": 1,
  "limit": 50,
  "accesos": [
    {
      "id": "a4be95f-...",
      "creado_en": "2026-06-20T10:30:00.000Z",
      "resultado": "exitoso",
      "ip_origen": "192.168.1.10",
      "descripcion": "Inicio de sesión exitoso",
      "usuario_id": "ca4be95f-...",
      "usuario_nombre": "Miguel Torres",
      "usuario_email": "miguel@rosabetania.com"
    },
    {
      "id": "b5cf06g-...",
      "creado_en": "2026-06-20T09:15:00.000Z",
      "resultado": "fallido",
      "ip_origen": "10.0.0.5",
      "descripcion": "Contraseña incorrecta",
      "usuario_id": "ca4be95f-...",
      "usuario_nombre": "Miguel Torres",
      "usuario_email": "miguel@rosabetania.com"
    },
    {
      "id": "c6dg17h-...",
      "creado_en": "2026-06-19T08:00:00.000Z",
      "resultado": "fallido",
      "ip_origen": "172.16.0.1",
      "descripcion": "Email no encontrado o usuario inactivo: desconocido@test.com",
      "usuario_id": null,
      "usuario_nombre": null,
      "usuario_email": null
    }
  ]
}
```

### Response 401

```json
{ "error": "UNAUTHORIZED" }
```

### Response 403

```json
{ "error": "FORBIDDEN", "required_role": "ADMINISTRADOR" }
```

## GET /api/accesos/usuarios-con-accesos

Lista simplificada de usuarios que tienen al menos un registro de acceso.
Usada para poblar el selector de filtro de usuario en el frontend.

**Autenticación**: Cookie `access_token` con rol `ADMINISTRADOR`.

### Response 200

```json
{
  "usuarios": [
    { "id": "uuid", "nombre": "Miguel Torres", "email": "miguel@rosabetania.com" }
  ]
}
```
