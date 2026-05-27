# Implementation Plan: Gestión Completa de Colaboradores

**Branch**: `014-employee-management` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-employee-management/spec.md`

## Summary

Completar el módulo de colaboradores añadiendo: (1) vista de lista con búsqueda client-side en
`/colaboradores`, (2) edición inline de datos básicos desde el perfil, y (3) baja/reactivación
con confirmación modal. La creación (wizard 6 pasos) ya está implementada y se integra al flujo
mediante el botón "Nuevo colaborador" en la lista.

## Technical Context

**Language/Version**: TypeScript 5 — Next.js 16 App Router (Node.js 24)

**Primary Dependencies**:
- MUI v9 (`@mui/material ^9.0.1`, `@mui/icons-material`)
- React Hook Form + Zod (validación en formulario de edición)
- `pg` Pool (direct SQL, no Prisma in `apps/web`)
- `jose` / `checkAdminRole` (auth JWT)

**Storage**: PostgreSQL vía `pg.Pool` — tablas `colaboradores`, `areas`, `registros_auditoria`

**Testing**: No test framework in `apps/web` — validación manual via quickstart

**Target Platform**: Vercel (Fluid Compute, App Router serverless)

**Performance Goals**: Lista de ≤500 colaboradores cargada en <2 s (SC-005); búsqueda instantánea client-side

**Constraints**: Sin paginación server-side (Option A de clarificaciones); ADMINISTRADOR únicamente

**Scale/Scope**: ≤500 colaboradores, 4 US, 3 nuevos endpoints, ~4 archivos modificados + 3 creados

## Constitution Check

| Principio | ¿Aplica? | Estado |
|---|---|---|
| I. Arquitectura Basada en Datos | Sí — cambios en `colaboradores` ya existe | ✅ Sin cambio de esquema |
| II. Código Limpio y Modular | Sí | ✅ Nuevos endpoints como extensión; no se toca código existente |
| VIII. RBAC | Sí — solo ADMINISTRADOR | ✅ `checkAdminRole` en todos los endpoints nuevos |
| IX. Trazabilidad de Ajustes | Sí — edición y baja son escrituras sensibles | ✅ Audit log en `registros_auditoria` para PATCH y baja |
| XI. Seguridad | Sí | ✅ JWT obligatorio en todos los endpoints |

**Veredicto**: Sin violaciones. Ningún gate bloqueante.

## Project Structure

### Documentation (this feature)

```text
specs/014-employee-management/
├── plan.md              # Este archivo
├── research.md          # Decisiones técnicas (Phase 0)
├── data-model.md        # Entidades y SQL relevante (Phase 1)
├── quickstart.md        # Escenarios de validación (Phase 1)
├── contracts/           # Contratos de API (Phase 1)
│   ├── GET-colaboradores.md
│   ├── PATCH-colaboradores-id.md
│   └── PATCH-colaboradores-id-estado.md
└── tasks.md             # Generado por /speckit-tasks
```

### Source Code

```text
apps/web/src/
├── app/
│   ├── (app)/colaboradores/
│   │   ├── page.tsx                       ← MODIFY: lista Server Component
│   │   ├── ColaboradoresListClient.tsx    ← CREATE: client-side search + tabla
│   │   └── [id]/
│   │       └── page.tsx                   ← MODIFY: añadir edición inline + baja
│   └── api/colaboradores/
│       ├── route.ts                       ← MODIFY: añadir GET (lista completa)
│       └── [id]/
│           ├── route.ts                   ← MODIFY: añadir PATCH (edición básica)
│           └── estado/
│               └── route.ts              ← CREATE: PATCH baja/reactivación
└── components/colaboradores/
    ├── ColaboradorPerfil.tsx              ← MODIFY: inline edit + baja dialog
    └── ColaboradoresList.tsx              ← CREATE: componente lista reutilizable
```

**Structure Decision**: Web-only (Next.js App Router). `apps/api` (NestJS) no se modifica en
este feature — toda la lógica vive en `apps/web` siguiendo el patrón establecido por specs 004,
005, 012, 013.

## Complexity Tracking

Sin violaciones de constitución — tabla no requerida.
