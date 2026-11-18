# Implementation Plan: Gestión de Parámetros de Configuración

**Branch**: `022-config-crud-params` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-config-crud-params/spec.md`

---

## Summary

Implementar la página `/configuracion` (actualmente ComingSoon) con CRUD completo para tres catálogos de parámetros: **Áreas** (tabla existente), **Tipos de Ajuste** (requiere nueva tabla y migración del enum `TipoAjusteDia`), y **Tipos de Período de Pago** (nueva tabla de configuración que preserva el enum de columna en `colaboradores`). Acceso exclusivo para ADMINISTRADOR.

---

## Technical Context

**Language/Version**: TypeScript / Node.js 20 LTS, PostgreSQL 15 (Supabase)

**Primary Dependencies**: Next.js 14 App Router, MUI v9, `pg` Pool (direct SQL), Zod, `bcryptjs` (no aplica aquí), `jose`

**Storage**: PostgreSQL — 2 nuevas tablas (`tipos_ajuste`, `tipos_periodo_pago`), 1 columna nueva en `liquidacion_jornada`

**Testing**: TypeScript check (`tsc --noEmit`) + prueba manual en browser

**Target Platform**: Web — desktop-first (admin únicamente)

**Project Type**: Web application (Next.js 14 monorepo)

**Performance Goals**: Carga de página < 3 s; operaciones CRUD < 500 ms

**Constraints**: Sin Prisma ORM en `apps/web` (usa `pg` Pool directo). `prisma db push` no disponible por error pre-existente en schema (`hora_entrada_esperada String @db.Time`). Migraciones via SQL directo en Supabase.

**Scale/Scope**: ~10 áreas, ~10 tipos de ajuste, 3 tipos de período de pago

---

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Arquitectura basada en datos | ✅ PASS | Modelo definido primero; migración documentada |
| II. Código limpio y modular | ✅ PASS | Componentes separados por catálogo; APIs bajo `/api/configuracion/` |
| III. Inmutabilidad biométrica | ✅ PASS | No toca registros biométricos |
| IV. Cálculo determinístico | ✅ PASS | Tipos de ajuste usan `ajuste_tipo_id` (FK) para nuevos registros; históricos preservados |
| V. Reglas configurables | ✅ PASS | Esta feature cumple el principio — hace los parámetros configurables |
| VIII. RBAC | ✅ PASS | Todas las rutas requieren rol ADMINISTRADOR vía `checkAdminRole` |
| IX. Trazabilidad | ⚠️ EXCEPCIÓN | Sin auditoría en cambios de catálogos (explícito en spec Assumptions — simplificación justificada) |
| XI. Seguridad | ✅ PASS | Auth en cada API route; validaciones en backend vía Zod |

**GATE: PASS** — Puede proceder a implementación.

---

## Project Structure

### Documentation (this feature)

```text
specs/022-config-crud-params/
├── plan.md              ← este archivo
├── research.md          ← decisiones técnicas
├── data-model.md        ← modelo de datos
├── contracts/
│   └── configuracion-api.md
└── tasks.md             ← generado por /speckit-tasks
```

### Source Code

```text
apps/web/src/
├── app/
│   ├── (app)/configuracion/
│   │   └── page.tsx                        ← replace ComingSoon
│   └── api/configuracion/
│       ├── areas/
│       │   ├── route.ts                    ← GET /areas, POST /areas
│       │   └── [id]/
│       │       └── route.ts                ← PATCH /areas/[id], DELETE /areas/[id]
│       ├── tipos-ajuste/
│       │   ├── route.ts                    ← GET /tipos-ajuste, POST /tipos-ajuste
│       │   └── [id]/
│       │       └── route.ts                ← PATCH /[id], DELETE /[id]
│       └── tipos-periodo-pago/
│           ├── route.ts                    ← GET /tipos-periodo-pago
│           └── [codigo]/
│               └── route.ts               ← PATCH /[codigo]
└── components/configuracion/
    ├── ConfiguracionPage.tsx               ← client component principal
    ├── AreasSection.tsx                    ← sección CRUD áreas
    ├── TiposAjusteSection.tsx              ← sección CRUD tipos ajuste
    └── TiposPeriodoPagoSection.tsx         ← sección tipos pago (sin create/delete)
```

---

## Constitution Check — Post-Design

Post data-model review: PASS sin cambios. La migración de `ajuste_tipo` a `ajuste_tipo_id` preserva datos históricos (el registro existente se migra). El enum `TipoAjusteDia` se elimina de `liquidacion_jornada` pero se preserva en Prisma schema como comentario hasta futura limpieza.

---

## Session Invalidation Strategy

No aplica — esta feature no modifica roles ni sesiones de usuarios.

---

## Key Technical Decisions

### 1. Áreas — sin cambios de schema

La tabla `areas` (`id, nombre, activo, creado_en`) ya existe y soporta CRUD completo. La ruta existente `GET /api/areas` solo devuelve activas para selectores; las rutas nuevas bajo `/api/configuracion/areas` exponen la gestión completa (activas + inactivas, con create/patch/delete).

### 2. Tipos de Ajuste — nueva tabla + migración del enum

**Problema**: `TipoAjusteDia` es un enum PostgreSQL; no permite agregar valores sin migración de schema.

**Solución**:
1. Crear tabla `tipos_ajuste` (`id UUID PK`, `nombre TEXT UNIQUE NOT NULL`, `activo BOOLEAN DEFAULT true`, `creado_en TIMESTAMPTZ`)
2. Sembrar los 4 valores existentes con nombres legibles
3. Agregar `ajuste_tipo_id UUID NULLABLE REFERENCES tipos_ajuste(id) ON DELETE SET NULL` a `liquidacion_jornada`
4. Migrar el 1 registro existente con `ajuste_tipo IS NOT NULL` a `ajuste_tipo_id`
5. Marcar `ajuste_tipo` (enum column) como deprecated — queda nullable; no se elimina en esta feature para no romper código existente que lo referencia
6. Nuevos registros de ajuste usan `ajuste_tipo_id`

El selector de ajuste en la UI de liquidaciones debe actualizarse para usar `tipos_ajuste WHERE activo = true`. Esto está fuera del scope de esta feature; las rutas existentes de dias-liquidacion se dejan como están — la conexión se hará en una feature futura.

> **Scope boundary**: Esta feature implementa el catálogo + CRUD UI. La migración de la UI de liquidaciones para usar el nuevo FK es **out of scope**.

### 3. Tipos de Período de Pago — tabla config, sin migrar FK

**Problema**: `colaboradores.tipo_pago` usa el enum `TipoPeriodoPago`. Migrarlo a FK requiere alterar una tabla con datos reales.

**Solución** (pragmática):
1. Crear tabla `tipos_periodo_pago` (`codigo VARCHAR(20) PK` coincide con enum value, `nombre TEXT NOT NULL`, `activo BOOLEAN DEFAULT true`)
2. Sembrar: ('SEMANAL', 'Semanal', true), ('QUINCENAL', 'Quincenal', true), ('MENSUAL', 'Mensual', true)
3. `colaboradores.tipo_pago` continúa usando el enum
4. La UI de Configuración administra `tipos_periodo_pago.activo`
5. El selector de tipo de pago en colaboradores consulta `tipos_periodo_pago WHERE activo = true` para filtrar opciones disponibles (futura feature — out of scope aquí)

**No hay migración de FK en esta feature** — solo se agrega la tabla de configuración.
