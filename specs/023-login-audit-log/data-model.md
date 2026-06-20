# Data Model: Registro de Accesos

**Feature**: 023-login-audit-log | **Date**: 2026-06-20

## Sin cambios al esquema

Esta feature no crea ni modifica tablas. Reutiliza `registros_auditoria`.

## Vista lógica de datos

```
registros_auditoria
─────────────────────────────────────
id              UUID PK
creado_en       TIMESTAMPTZ NOT NULL
accion          TEXT NOT NULL         ← 'LOGIN_EXITOSO' | 'LOGIN_FALLIDO'
ip_origen       TEXT NULL
descripcion     TEXT NULL
usuario_id      UUID NULL FK → usuarios(id) ON DELETE SET NULL

usuarios (JOIN)
─────────────────────────────────────
id              UUID PK
nombre          TEXT
apellido        TEXT
email           TEXT
```

## Consulta canónica

```sql
SELECT
  ra.id,
  ra.creado_en,
  ra.accion,
  ra.ip_origen,
  ra.descripcion,
  ra.usuario_id,
  u.nombre  AS usuario_nombre,
  u.apellido AS usuario_apellido,
  u.email   AS usuario_email
FROM registros_auditoria ra
LEFT JOIN usuarios u ON u.id = ra.usuario_id
WHERE ra.accion IN ('LOGIN_EXITOSO', 'LOGIN_FALLIDO')
  -- filtros opcionales:
  -- AND ra.usuario_id = $usuario_id
  -- AND ra.accion = $accion_filtro
  -- AND ra.creado_en >= $desde
  -- AND ra.creado_en <= $hasta
ORDER BY ra.creado_en DESC
LIMIT $limit OFFSET $offset;
```

## Mapeo a DTO

| Campo DB | Campo API | Transformación |
|----------|-----------|----------------|
| `accion = 'LOGIN_EXITOSO'` | `resultado = 'exitoso'` | Normalizar a español lowercase |
| `accion = 'LOGIN_FALLIDO'` | `resultado = 'fallido'` | Normalizar a español lowercase |
| `u.nombre + ' ' + u.apellido` | `usuario_nombre` | Concatenar; null si sin usuario |
| `u.email` | `usuario_email` | null si sin usuario |
