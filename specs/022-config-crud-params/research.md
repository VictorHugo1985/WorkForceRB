# Research: Gestión de Parámetros de Configuración

**Feature**: 022-config-crud-params | **Date**: 2026-06-18

No hay NEEDS CLARIFICATION pendientes — todo el contexto técnico fue resuelto por inspección directa del código base. Este documento registra las decisiones tomadas y sus rationales.

---

## Decision 1: Gestión de Áreas — Nuevas rutas bajo `/api/configuracion/areas`

**Decision**: Crear rutas nuevas en `/api/configuracion/areas/` (GET + POST) y `/api/configuracion/areas/[id]/` (PATCH + DELETE) **en lugar de** extender la ruta existente `/api/areas/`.

**Rationale**: La ruta `/api/areas/route.ts` existente devuelve solo áreas activas para selectores de colaboradores. Cambiar su contrato rompería la UI de colaboradores. Las rutas de configuración exponen todas las áreas (activas + inactivas) con CRUD completo — semanticas distintas.

**Alternatives considered**:
- Extender `/api/areas` con query param `?all=true` — descartado, mezcla semánticas de admin y dropdown
- Reemplazar `/api/areas` — descartado, rompe el selector de colaboradores que ya funciona

---

## Decision 2: `TipoAjusteDia` enum → tabla `tipos_ajuste`

**Decision**: Crear la tabla `tipos_ajuste` y agregar FK `ajuste_tipo_id` a `liquidacion_jornada`. Mantener la columna `ajuste_tipo` (enum) como deprecated (nullable) para no romper código existente.

**Rationale**: El enum de PostgreSQL no permite agregar valores sin DDL. Solo hay 1 registro existente con `ajuste_tipo IS NOT NULL`, por lo que la migración es de riesgo mínimo. Los ajustes futuros usan `ajuste_tipo_id`.

**Alternatives considered**:
- Mantener enum puro, sin cambio — descartado, impide el FR-011 (crear nuevos tipos)
- Migrar completamente (drop enum column, update code) — descartado en esta feature; el código de liquidaciones que referencia `ajuste_tipo` queda fuera de scope y se rompe si se elimina la columna

**Migration SQL** (a ejecutar en Supabase):
```sql
-- 1. Crear tabla
CREATE TABLE tipos_ajuste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sembrar con valores existentes del enum
INSERT INTO tipos_ajuste (nombre) VALUES
  ('Bono por Horas Extras'),
  ('Bono por Transporte'),
  ('Estipendio'),
  ('Descuento');

-- 3. Agregar FK a liquidacion_jornada
ALTER TABLE liquidacion_jornada
  ADD COLUMN ajuste_tipo_id UUID REFERENCES tipos_ajuste(id) ON DELETE SET NULL;

-- 4. Migrar el 1 registro existente
UPDATE liquidacion_jornada
SET ajuste_tipo_id = (
  SELECT id FROM tipos_ajuste WHERE nombre = CASE ajuste_tipo
    WHEN 'BONO_HORAS_EXTRAS' THEN 'Bono por Horas Extras'
    WHEN 'BONO_TRANSPORTE'   THEN 'Bono por Transporte'
    WHEN 'ESTIPENDIO'        THEN 'Estipendio'
    WHEN 'DESCUENTO'         THEN 'Descuento'
  END
)
WHERE ajuste_tipo IS NOT NULL;
```

---

## Decision 3: `TipoPeriodoPago` — tabla de configuración sin migrar FK

**Decision**: Crear tabla `tipos_periodo_pago` (`codigo VARCHAR(20) PK`, `nombre TEXT NOT NULL`, `activo BOOLEAN DEFAULT true`). `colaboradores.tipo_pago` sigue usando el enum `TipoPeriodoPago`.

**Rationale**: Migrar `colaboradores.tipo_pago` a FK requiere `ALTER TABLE` en producción con datos reales y actualización de todos los endpoints de colaboradores. El beneficio es bajo porque los valores de pago son estables (solo 3). La tabla de configuración sirve como capa de administración sin riesgo de migración.

**Alternatives considered**:
- Migrar FK completo — descartado, alto riesgo de ruptura con beneficio marginal para P3
- Solo enum (sin tabla nueva) — descartado, no permite gestionar `activo` desde UI

**Migration SQL**:
```sql
CREATE TABLE tipos_periodo_pago (
  codigo VARCHAR(20) PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO tipos_periodo_pago (codigo, nombre) VALUES
  ('SEMANAL', 'Semanal'),
  ('QUINCENAL', 'Quincenal'),
  ('MENSUAL', 'Mensual');
```

---

## Decision 4: Layout de página `/configuracion` — secciones en tabs MUI

**Decision**: Usar `Tabs` de MUI para las 3 secciones dentro de `/configuracion`. El tab activo por defecto es "Áreas" (P1).

**Rationale**: Tres secciones en una sola página sin sub-rutas (conforme al spec). Tabs mantiene el layout limpio y permite navegar entre catálogos sin recargar la página. Consistente con el patrón usado en el dashboard.

**Alternatives considered**:
- Tres secciones colapsables en cascada — descartado, requiere scroll y es visualmente más complejo
- Sub-rutas `/configuracion/areas` etc. — descartado, el spec dice explícitamente que no hay sub-rutas

---

## Decision 5: Guardia "último elemento activo"

**Decision**: Implementar el guard en el backend (API) para todas las entidades. Respuesta 422 con mensaje JSON descriptivo.

**Rationale**: La validación en frontend es UX, pero la correcta en backend garantiza integridad. El spec FR-006 requiere impedir inactivar/eliminar el último activo.

**Query template**:
```sql
-- Ejemplo para áreas al inactivar
SELECT COUNT(*) FROM areas WHERE activo = true AND id != $1
-- Si 0, rechazar con 422
```
