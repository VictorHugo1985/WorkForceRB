# Implementation Plan: Evaluaciones del Personal

**Branch**: `024-staff-evaluations` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-staff-evaluations/spec.md`

## Summary

Permitir que ADMINISTRADOR y SUPERVISOR registren evaluaciones de desempeño de cualquier colaborador, usando un conjunto global de criterios ponderados (escala 1–10, pesos que suman 100%) que el ADMINISTRADOR configura en una nueva pestaña de Configuración. Cada evaluación guarda una copia (snapshot) de los criterios y pesos de ese momento, calcula el puntaje final ponderado en el servidor y queda en el histórico del colaborador. El ADMINISTRADOR puede anularla con motivo. Se implementa como un módulo nuevo en `apps/web` (Route Handlers + `pg`), con 3 tablas nuevas y sin tocar las existentes.

## Technical Context

**Language/Version**: TypeScript 5 — Node.js 20 (Next.js 16.2.6, React 19.2)

**Primary Dependencies**: Next.js App Router, MUI (`@mui/material` ^9), `pg` (Pool), `jose` (JWT), `zod` ^4, `node:crypto` (hash de `config_version`)

**Storage**: PostgreSQL 15 (Supabase). Tablas nuevas `criterios_evaluacion`, `evaluaciones`, `evaluacion_detalles`; reutiliza `colaboradores`, `usuarios`, `registros_auditoria`

**Testing**: Manual según `quickstart.md` (no hay una suite automatizada activa)

**Target Platform**: Web (Vercel, runtime Node.js)

**Project Type**: Web application — monorepo; cambios solo en `apps/web` + script SQL + documentación en `apps/api/prisma/schema.prisma`

**Performance Goals**: Histórico de hasta 100 evaluaciones en < 2 s (SC-004); listado principal paginado de 50 en < 2 s

**Constraints**: Sin Prisma en `apps/web`; migración por SQL manual en Supabase (up + down); sin modificar tablas existentes; fecha local GMT-4

**Scale/Scope**: < 200 colaboradores, decenas de evaluaciones por mes, ~10 criterios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Arquitectura basada en datos | ✅ | Modelo y diccionario en `data-model.md` antes del código; solo se agregan tablas nuevas |
| II. Código limpio y modular | ✅ | Módulo `evaluaciones` aislado; helper `checkRoles` generaliza `checkAdminRole` sin romper a quienes ya lo usan; lógica de cálculo en `lib/evaluaciones.ts` |
| III. Inmutabilidad biométrica | N/A | No se tocan eventos biométricos |
| IV. Cálculo determinístico | ✅ | `puntaje_final` se calcula en el servidor a partir de los puntajes y pesos copiados; se puede reproducir desde `evaluacion_detalles` |
| V. Reglas configurables | ✅ | Criterios y pesos son configurables; la copia en cada evaluación equivale a "la configuración vigente en ese momento" |
| VI. Ciclo semanal | N/A | Las evaluaciones no dependen de la semana laboral |
| VIII. RBAC | ⚠️ Justificado | Verificación de rol en el proxy, en la página y en la API. El SUPERVISOR accede a **todos** los colaboradores (no solo a su equipo) por decisión del usuario → Complexity Tracking |
| IX. Trazabilidad | ✅ | Auditoría en la misma transacción para cada escritura; anulación con motivo, usuario y fecha; nada se borra |
| XI. Seguridad | ✅ | JWT + revocación + validez de sesión; migración reversible (`migration-down.sql`); consultas parametrizadas |

**Veredicto (pre-research)**: Pasa con 1 desviación justificada.
**Veredicto (post-design)**: Sin cambios: el diseño de Phase 1 no introduce nuevas violaciones.

## Project Structure

### Documentation (this feature)

```text
specs/024-staff-evaluations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── migration.sql            ← UP (Supabase SQL Editor)
├── migration-down.sql       ← DOWN
├── contracts/
│   └── evaluaciones-api.md
├── checklists/requirements.md
└── tasks.md                 (/speckit-tasks)
```

### Source Code

```text
apps/web/src/
├── lib/
│   ├── auth-server.ts                              ← + checkRoles(req, roles); checkAdminRole delega en él
│   ├── nav-config.ts                               ← + /evaluaciones (ADMINISTRADOR, SUPERVISOR)
│   └── evaluaciones.ts                             ← nuevo: calcularPuntajeFinal, configVersion, sumaPesos, todayGMTMinus4
├── app/
│   ├── (app)/
│   │   └── evaluaciones/
│   │       ├── page.tsx                            ← lista de colaboradores (guard ADMIN/SUPERVISOR)
│   │       └── [colaboradorId]/page.tsx            ← histórico del colaborador
│   └── api/
│       ├── configuracion/criterios-evaluacion/
│       │   ├── route.ts                            ← GET, POST
│       │   ├── [id]/route.ts                       ← PATCH
│       │   └── pesos/route.ts                      ← PUT (redistribución masiva)
│       └── evaluaciones/
│           ├── route.ts                            ← POST
│           ├── criterios-vigentes/route.ts         ← GET
│           ├── colaboradores/route.ts              ← GET (pantalla principal)
│           ├── colaboradores/[colaboradorId]/route.ts ← GET (histórico)
│           ├── [id]/route.ts                       ← GET (detalle)
│           └── [id]/anular/route.ts                ← POST (solo ADMIN)
└── components/
    ├── configuracion/
    │   ├── ConfiguracionPage.tsx                   ← + pestaña "Criterios de evaluación"
    │   └── CriteriosEvaluacionSection.tsx          ← nuevo: CRUD + suma en vivo + diálogo de redistribución
    └── evaluaciones/
        ├── EvaluacionesListClient.tsx              ← tabla de colaboradores + buscador + filtro de inactivos
        ├── NuevaEvaluacionDialog.tsx               ← formulario 1–10 por criterio + vista previa del puntaje
        ├── HistorialClient.tsx                     ← resumen + lista de evaluaciones
        ├── EvaluacionDetalleDialog.tsx             ← detalle por criterio
        └── AnularEvaluacionDialog.tsx              ← motivo obligatorio

apps/api/prisma/schema.prisma                      ← + modelos (solo documentación del esquema)
```

**Structure Decision**: Un módulo `evaluaciones` autocontenido en `apps/web`, con el mismo patrón que `accesos` (023) y `configuracion` (022). Los únicos archivos existentes que se tocan son `nav-config.ts` (entrada de navegación), `ConfiguracionPage.tsx` (nueva pestaña) y `auth-server.ts` (helper de roles agregado).

## Key Design Decisions

Detalle en [research.md](./research.md):

1. **Copia (snapshot)** de nombre y peso en `evaluacion_detalles` → el histórico es inmutable ante cambios de configuración (R3).
2. **Suma = 100%** se valida al evaluar y en el guardado masivo de pesos, no en cada edición individual (R4).
3. **`config_version`** (hash de los criterios activos) detecta cambios concurrentes → 409 `CRITERIOS_CAMBIARON` (R5).
4. **Cálculo en el servidor** con aritmética en centésimas → `NUMERIC(4,2)` (R6).
5. **`checkRoles`** reutilizable para ADMIN+SUPERVISOR; anular y criterios solo ADMIN (R7).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| SUPERVISOR evalúa y ve el histórico de cualquier colaborador (principio VIII: "equipo asignado") | Decisión explícita del usuario en la clarificación del 2026-11-18: el histórico debe reflejar todo el desempeño del trabajador, y la asignación supervisor–colaborador (`colaboradores.supervisor_id`) es opcional y no siempre está cargada | Filtrar por `supervisor_id` dejaría a colaboradores sin supervisor fuera de toda evaluación por parte de supervisores y fragmentaría el histórico |
