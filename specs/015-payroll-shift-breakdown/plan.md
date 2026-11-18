# Implementation Plan: Daily Shift Breakdown in Weekly Payroll

**Branch**: `015-payroll-shift-breakdown` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/015-payroll-shift-breakdown/spec.md`

## Summary

Enhance the weekly payroll detail view (`DiaLiquidacionTable`) to show, per day, the individual worked shifts (entry–exit pairs derived from biometric punches), an accumulated-hours column, and a visual warning when an isolated (unpaired) punch is detected. Inconsistencies are resolved via the existing `DiaAjusteDialog` — no new API routes or DB migrations required. The hour calculation algorithm also changes from first-to-last punch (MIN/MAX) to sum-of-paired-shift durations.

## Technical Context

**Language/Version**: TypeScript / Node.js 20 (Next.js 14 App Router)

**Primary Dependencies**: MUI v5, React Hook Form + Zod, Zustand, `pg` (PostgreSQL client)

**Storage**: PostgreSQL — reads from `eventos_biometricos_desglosados` and `codigos_colaborador`; updates `dias_liquidacion.horas_calculadas` in-place for SIN_REVISION days

**Testing**: Manual integration test via browser (see quickstart.md)

**Target Platform**: Vercel (Next.js web app, `apps/web`)

**Performance Goals**: `getLiquidacionDetail` latency unchanged — one additional batch SQL query (array_agg per day) replaces the previous MIN/MAX aggregate

**Constraints**: No DB migrations; no new API endpoints; existing `DiaAjusteDialog` PATCH route unchanged

**Scale/Scope**: Single-collaborator week view; typically ≤ 30 punches per week

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Arquitectura Basada en Datos | ✅ Pass | No DB schema changes; new types are in-memory only |
| II. Código Limpio Modular | ✅ Pass | Extension of existing components; no duplication |
| III. Inmutabilidad Biométrica | ✅ Pass | Raw events never modified; read-only from this feature |
| IV. Cálculo Determinístico | ✅ Pass | New paired-shift algorithm is deterministic; in-place update of SIN_REVISION days is auditable |
| IX. Trazabilidad de Ajustes | ✅ Pass | Isolated-punch exclusion requires `motivoAjuste` through DiaAjusteDialog |

## Project Structure

### Documentation (this feature)

```text
specs/015-payroll-shift-breakdown/
├── plan.md              ← This file
├── research.md          ← Architecture decisions
├── data-model.md        ← Type extensions + derivation rules
├── quickstart.md        ← Integration test scenarios
├── contracts/
│   └── dia-liquidacion-ui.md   ← UI layout contract
├── checklists/
│   └── requirements.md
└── tasks.md             ← Created by /speckit-tasks
```

### Source Code (files to change)

```text
apps/web/src/
├── stores/
│   └── liquidacion.store.ts          ← Add Jornada type; extend DiaLiquidacionData
├── lib/
│   └── liquidacion-db.ts             ← Refactor shift calculation + extend getLiquidacionDetail
└── components/liquidaciones/
    ├── DiaLiquidacionTable.tsx        ← Add collapse/expand, shift sub-rows, inconsistency badge
    └── DiaAjusteDialog.tsx            ← Add isolated-punch quick-fix section
```

No new files. No new API routes.

## Key Design Decisions

### 1. Shift Pairing Algorithm

```
punches ← sorted ascending by checktime
for i = 0, 2, 4, …:
  if i+1 < len(punches):
    jornadas.push({ entrada: punches[i], salida: punches[i+1] })
  else:
    marcacionSuelta = punches[i]
    tieneInconsistencia = true
horasParejadas = Σ (salida_i − entrada_i) for each jornada
```

### 2. Batch Punch Query (one query per getLiquidacionDetail call)

```sql
SELECT ebd.checktime::date AS fecha,
       array_agg(ebd.checktime ORDER BY ebd.checktime) AS marcaciones
FROM eventos_biometricos_desglosados ebd
JOIN codigos_colaborador cc
     ON cc.codigo_biometrico = ebd.employee_workno AND cc.activo = true
WHERE cc.colaborador_id = $1
  AND ebd.checktime::date BETWEEN $2 AND $3
GROUP BY ebd.checktime::date
```

Result is a `Map<dateString, Date[]>` keyed by `fecha`. TypeScript iterates each array to pair punches.

### 3. Self-Correcting horas_calculadas

For any `DiaLiquidacionData` where `estadoDia = 'SIN_REVISION'` and `horasParejadas ≠ horasCalculadas` (old MIN/MAX value), issue an UPDATE to bring `horas_calculadas` in sync. Totals recalculated immediately after. This handles migration of existing BORRADOR rows transparently.

### 4. DiaAjusteDialog Quick-Fix

When `dia.tieneInconsistencia`:
- Show banner: "⚠ Marcación suelta detectada: HH:MM"
- Show button: "Excluir marcación suelta"
  - Pre-fills `horasAjustadasSupervisor` = `dia.horasParejadas`
  - Pre-fills `motivoAjuste` = `"Marcación suelta excluida del cálculo"`
  - Does NOT auto-submit; reviewer confirms

### 5. Collapsible Day Rows

Default: collapsed. Click day row or expand icon to reveal shift sub-rows. Rows with zero events and `tieneInconsistencia = false` have no expand icon (nothing to show).

## Complexity Tracking

No Constitution violations. No complexity justification required.
