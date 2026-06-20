# Research: Registro de Accesos (Login Audit Log)

**Feature**: 023-login-audit-log | **Date**: 2026-06-20

## Hallazgos clave

### 1. El login ya registra los eventos necesarios

El route `/apps/web/src/app/api/auth/login/route.ts` inserta en `registros_auditoria`:

- **Login exitoso** (`accion = 'LOGIN_EXITOSO'`): `usuario_id`, `ip_origen`, descripción fija.
- **Login fallido** (`accion = 'LOGIN_FALLIDO'`): `usuario_id` (null si email no existe), `ip_origen`, descripción con el motivo.

**Conclusión**: No es necesario modificar el route de login ni crear tabla nueva.

### 2. Estructura de `registros_auditoria`

Columnas disponibles: `id` (UUID), `usuario_id` (UUID nullable FK → usuarios), `accion` (text), `entidad_tipo`, `entidad_id`, `descripcion`, `ip_origen`, `datos_anteriores`, `datos_nuevos`, `creado_en`.

Para la vista de accesos se usan: `id`, `creado_en`, `accion`, `ip_origen`, `descripcion`, `usuario_id` + JOIN a `usuarios` para nombre y email.

### 3. Patrón establecido para pages protegidas (ADMINISTRADOR)

`UsuariosPage` (`apps/web/src/app/(app)/usuarios/page.tsx`) es la referencia:
- Server component async
- Verifica cookie `access_token` → `verifyToken` → `isBlacklisted`
- `redirect('/dashboard')` si no tiene rol ADMINISTRADOR
- Carga datos desde DB y pasa a client component

### 4. Navegación basada en roles

`nav-config.ts` centraliza `NAV_ITEMS` (filtrados por rol en el sidebar) y `ROUTE_ROLES`
(usado potencialmente por guards futuros). Agregar `/accesos` en ambos con `['ADMINISTRADOR']`
es suficiente.

### 5. No hay índice en `registros_auditoria` por `accion`

La consulta filtrará por `accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')`. Con volumen pequeño
(< 50 usuarios, decenas de accesos diarios) no es necesario un índice adicional en esta fase.
Si el volumen crece, se puede añadir `CREATE INDEX ON registros_auditoria (accion, creado_en DESC)`.
