# Implementation Plan: Reporte de Horas Trabajadas

**Branch**: `025-worked-hours-report` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-worked-hours-report/spec.md`

## Summary

Nueva sección "Horas trabajadas" (ADMINISTRADOR y SUPERVISOR) con una tabla de colaboradores × meses o semanas para el último trimestre, semestre o año (períodos móviles). Las horas se calculan en el momento **solo a partir de las marcaciones biométricas**, emparejadas con las mismas reglas que ya usa el sistema (función pura `buildJornadas` + cruce de medianoche de ≤ 12 h), sin leer ninguna tabla de liquidaciones. Cada celda muestra horas y un indicador ⚠ con los días incompletos, y desde ella se abre el detalle diario. No hay cambios de esquema.

## Technical Context

**Language/Version**: TypeScript 5 — Node.js 20 (Next.js 16.2.6, React 19.2)

**Primary Dependencies**: Next.js App Router, MUI (`@mui/material` ^9), `pg` (Pool), `jose` (JWT), `zod` ^4

**Storage**: PostgreSQL 15 (Supabase), solo lectura: `eventos_biometricos_desglosados`, `codigos_colaborador`, `colaboradores`, `areas`. Sin migraciones.

**Testing**: Manual (`quickstart.md`) + script de verificación de invariantes (SC-003/SC-004) contra la BD en solo lectura

**Target Platform**: Web (Vercel, runtime Node.js)

**Project Type**: Web application — cambios solo en `apps/web`

**Performance Goals**: Reporte de un año < 5 s (medido: la consulta de ~20 000 marcaciones tarda ~1,1 s desde fuera de la región)

**Constraints**: No leer tablas `liquidacion_*`; no modificar `liquidacion-db.ts`; fecha local GMT-4 vía `utc_offset`

**Scale/Scope**: ~70 colaboradores, ~45 000 marcaciones/año, máx. 53 columnas semanales

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Nota |
|-----------|--------|------|
| I. Arquitectura basada en datos | ✅ | Sin cambios de esquema; lectura de tablas existentes documentadas en `data-model.md` |
| II. Código limpio y modular | ✅ | Módulo nuevo `horas-trabajadas`; reutiliza `buildJornadas` sin modificarla; el agrupado por lotes vive en `lib/horas-trabajadas.ts` |
| III. Inmutabilidad biométrica | ✅ | Solo lectura de marcaciones |
| IV. Cálculo determinístico | ✅ | Mismas marcaciones → mismas horas; misma aritmética que liquidaciones (función compartida) |
| VI. Ciclo semanal | ✅ | Vista semanal lunes a domingo |
| VIII. RBAC | ⚠️ Justificado | Guard por rol en el proxy, la página y la API. El SUPERVISOR ve a todos los colaboradores (no solo a su equipo) → Complexity Tracking |
| IX. Trazabilidad | N/A | No hay escrituras |
| X. Tiempo real | ✅ | Cálculo en el momento: refleja las marcaciones más recientes al cargar |
| XI. Seguridad | ✅ | JWT + validez de sesión; consultas parametrizadas; sin migraciones |

**Veredicto (pre-research)**: Pasa con 1 desviación justificada.
**Veredicto (post-design)**: Sin cambios.

## Project Structure

### Documentation (this feature)

```text
specs/025-worked-hours-report/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── horas-trabajadas-api.md
├── checklists/requirements.md
└── tasks.md                 (/speckit-tasks)
```

### Source Code

```text
apps/web/src/
├── lib/
│   ├── horas-trabajadas.ts                     ← nuevo (servidor): períodos/tramos, consulta por lotes, cruce de medianoche, jornadas, agregación
│   ├── horas-trabajadas-types.ts               ← nuevo (compartido): tipos del contrato + formateo
│   ├── nav-config.ts                           ← + /horas-trabajadas (ADMINISTRADOR, SUPERVISOR)
│   └── liquidacion-db.ts                       ← (sin cambios; se importa buildJornadas)
├── app/
│   ├── (app)/horas-trabajadas/page.tsx         ← server component (guard + carga inicial)
│   └── api/horas-trabajadas/
│       ├── route.ts                            ← GET reporte
│       └── detalle/route.ts                    ← GET detalle diario
└── components/
    ├── layout/AppSidebar.tsx                   ← + icono
    └── horas-trabajadas/
        ├── HorasTrabajadasClient.tsx           ← selectores período/agrupación, filtros, tabla, totales/promedios
        └── DetalleHorasDialog.tsx              ← detalle diario de una celda
```

**Structure Decision**: Un módulo `horas-trabajadas` autocontenido, con el mismo patrón que 023 y 024. Solo se tocan `nav-config.ts` y `AppSidebar.tsx` (entrada de menú).

## Key Design Decisions

Detalle en [research.md](./research.md):

1. **Cálculo en el momento**, una consulta por período (R1).
2. **Reutilizar `buildJornadas`** sin modificarla + cruce de medianoche por lotes, idéntico a `fetchPunchMap` (R2). Cero lecturas de `liquidacion_*`.
3. **Semanas ISO recortadas al período** → totales idénticos entre agrupaciones (R4).
4. **Filtros, orden, totales y promedios en el cliente** (R5).
5. **Detalle diario en un endpoint aparte** (R6).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| SUPERVISOR ve las horas de todos los colaboradores (principio VIII: "equipo asignado") | Decisión explícita del usuario (aclaración del 2026-11-18), coherente con Eventos (013) y Evaluaciones (024) | Filtrar por `supervisor_id` (opcional) dejaría fuera a colaboradores sin supervisor y daría vistas parciales |
