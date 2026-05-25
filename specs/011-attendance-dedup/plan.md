# Implementation Plan: Control de Eventos Biométricos Duplicados

**Branch**: `011-attendance-dedup` | **Date**: 2026-05-22 | **Spec**: [spec.md](spec.md)

## Summary

Implementar detección automática de marcaciones biométricas potencialmente duplicadas (mismo colaborador, mismo tipo ENTRADA/SALIDA, dentro de ventana configurable de 2 minutos) con marcado visual en el historial de asistencia y capacidad de descarte manual por supervisor, cajero o administrador. La solución extiende el pipeline de procesamiento de eventos de spec 001 con un `DeduplicationService`, amplía el enum `EstadoResolucion` con `POTENCIAL_DUPLICADO` y `DUPLICADO`, y agrega acciones de descarte/confirmación con registro de auditoría y recálculo de horas.

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**:
- NestJS — `apps/api` (módulos, guards de rol, decoradores)
- Prisma (`@workforce/database`) — ORM, migración de enum y nueva columna
- class-validator + Zod + nestjs-zod — validación de DTOs
- Next.js 14 (App Router) — `apps/web`
- MUI v5 (Material UI 5.15) + Emotion 11 — DataGrid, Chip, Dialog
- React Hook Form + Zod — modal de justificación
- Zustand — estado de sesión (ya implementado en spec 010)

**Storage**: PostgreSQL vía Prisma. Migración additive:
- 2 valores al enum `EstadoResolucion` (POTENCIAL_DUPLICADO, DUPLICADO)
- 1 columna nullable a `eventos_biometricos` (evento_referencia_id: UUID FK)
- 1 columna con default a `eventos_biometricos_desglosados` (tipo_evento: TipoEvento enum)
- 1 valor al enum `TipoConfiguracion` (DEDUP_WINDOW_MINUTES)
- 2 índices nuevos para performance de la consulta de detección

**Testing**: Jest (unit: DeduplicationService, guards); supertest (integration: pipeline + API); React Testing Library (unit: modal, highlight row)

**Target Platform**: NestJS server (`apps/api`) + Browser (`apps/web`)

**Performance Goals**:
- Detección de duplicado en ≤50ms adicionales al pipeline de spec 001
- Recálculo post-descarte ≤2s (scope: un colaborador × un día)
- Respuesta del PATCH /discard en ≤300ms p95

**Constraints**:
- EventoBiometrico es append-only; se permiten transiciones de `estado_resolucion` pero no modificaciones de payload ni eliminación
- Detección sincrónica en el pipeline (no cola async): alcanza para el pico de 50 eventos/turno
- Ventana de dedup es global; no configurable por colaborador ni dispositivo en esta feature
- CAJERO puede descartar/confirmar (autorización explícita de spec 011 FR-008)

**Scale/Scope**: ~50 eventos concurrentes pico, ~1000 eventos/día estimados, 4 roles

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Arquitectura Basada en Datos | ✅ | Migración additive al modelo aprobado de spec 003; 4 enmiendas documentadas en data-model.md |
| II. Código Limpio y Modular | ✅ | `DeduplicationService` independiente; extendiendo pipeline de spec 001 como módulo separado |
| III. Inmutabilidad del Registro Biométrico | ✅ | Los eventos nunca se eliminan; las acciones de descarte son transiciones de estado auditadas |
| IV. Cálculo Determinístico y Auditable | ✅ | Exclusión de DUPLICADO en cálculos es determinística; toda acción registrada en auditoría |
| VIII. RBAC (v1.1.0) | ✅ | CAJERO incluido como actor autorizado (FR-008); SUPERVISOR restringido a su equipo |
| IX. Trazabilidad Obligatoria de Ajustes | ✅ | FR-009: toda acción (descarte, confirmación) con usuario, timestamp, justificación y estado anterior/nuevo |
| XI. Seguridad y Protección de Datos | ✅ | JWT HttpOnly cookie; guards de rol en todos los endpoints de escritura |

## Project Structure

### Documentation (this feature)

```text
specs/011-attendance-dedup/
├── plan.md          ← este archivo
├── research.md      ← decisiones técnicas (6 decisiones)
├── data-model.md    ← 4 enmiendas al modelo base (spec 003)
├── contracts/
│   └── api.md       ← endpoints PATCH /discard, /confirm-valid, GET /biometric-events
└── tasks.md         ← (generado por /speckit-tasks)
```

### Source Code

```text
apps/api/
├── prisma/
│   └── migrations/
│       └── YYYYMMDDHHMMSS_attendance_dedup/   # Migración additive
│           └── migration.sql
├── src/
│   ├── deduplication/
│   │   ├── deduplication.module.ts
│   │   ├── deduplication.service.ts            # checkAndMark(eventId): detección + flag
│   │   └── deduplication.service.spec.ts
│   └── biometric-events/
│       ├── biometric-events.module.ts
│       ├── biometric-events.controller.ts      # PATCH /:id/discard, PATCH /:id/confirm-valid
│       ├── biometric-events.service.ts         # discard(), confirmValid() + recalc trigger
│       ├── biometric-events.controller.spec.ts
│       ├── biometric-events.service.spec.ts
│       └── dto/
│           └── event-action.dto.ts             # { justificacion: string }

apps/web/
├── src/
│   ├── app/(app)/asistencia/
│   │   └── [colaboradorId]/
│   │       └── page.tsx                        # Historial con filtros de estado
│   └── components/attendance/
│       ├── AttendanceEventRow.tsx              # Row con highlight visual POTENCIAL_DUPLICADO
│       ├── DuplicateActionModal.tsx            # Modal: Descartar / Confirmar como válido + justificación
│       └── DuplicateStatusChip.tsx            # Chip de estado: Potencial Duplicado | Descartado
└── tests/
    ├── unit/
    │   └── components/attendance/
    │       ├── AttendanceEventRow.test.tsx
    │       └── DuplicateActionModal.test.tsx
    └── integration/
        └── attendance-dedup.test.ts            # Pipeline webhook → detección → descarte → recálculo
```

**Structure Decision**: Monorepo (apps/api + apps/web). `DeduplicationService` en módulo propio para desacoplarlo del módulo de biometric-events. El módulo `biometric-events` (si no existe aún) se crea en esta feature para exponer los endpoints de descarte/confirmación.

## Implementation Phases

### Fase A — Migración de Base de Datos (Prerequisito)

1. Verificar que la migración de spec 001 (pipeline de eventos) esté aplicada y que `eventos_biometricos_desglosados` exista.
2. Crear migración Prisma:
   - Añadir `POTENCIAL_DUPLICADO`, `DUPLICADO` a enum `EstadoResolucion`
   - Añadir `evento_referencia_id UUID NULL REFERENCES eventos_biometricos(id)` a `eventos_biometricos`
   - Añadir enum `TipoEvento { ENTRADA, SALIDA, DESCONOCIDO }` y columna `tipo_evento TipoEvento NOT NULL DEFAULT 'DESCONOCIDO'` a `eventos_biometricos_desglosados`
   - Añadir `DEDUP_WINDOW_MINUTES` a enum `TipoConfiguracion`
   - Crear índices para performance de la consulta de detección
   - Seed: insertar ConfiguracionRegla para DEDUP_WINDOW_MINUTES con valor 2
3. Actualizar `schema.prisma` con relación self-referencial nombrada `DuplicadoDe`.
4. Regenerar Prisma client.

### Fase B — Backend: DeduplicationService

1. Crear `DeduplicationModule` + `DeduplicationService`.
2. Implementar `checkAndMark(eventId: string)`:
   - Leer evento + desglose (tipo_evento, checktime, colaborador_id)
   - Si `tipo_evento = DESCONOCIDO` → skip (no se puede detectar por tipo)
   - Leer `DEDUP_WINDOW_MINUTES` de ConfiguracionRegla (con caché en memoria, TTL 60s)
   - Consultar último evento `RESUELTO` del mismo colaborador + tipo_evento dentro de la ventana
   - Si encontrado → UPDATE estado_resolucion = POTENCIAL_DUPLICADO, evento_referencia_id = id encontrado
3. Conectar al pipeline de spec 001: llamar `checkAndMark` después de la resolución de colaborador, antes del trigger de cálculo.
4. Unit tests: ventana exacta, justo antes del límite, justo después, tipo distinto no detecta duplicado, tres eventos en ráfaga.

### Fase C — Backend: API de Descarte y Confirmación

1. Crear `BiometricEventsModule` (o extender si ya existe de spec 001).
2. Implementar `BiometricEventsController`:
   - `PATCH /:id/discard`: guard de roles + scope de equipo (SUPERVISOR), llama a `biometricEventsService.discard(id, userId, justificacion)`
   - `PATCH /:id/confirm-valid`: guard de roles + scope de equipo, llama a `biometricEventsService.confirmValid(id, userId, justificacion)`
3. Implementar `BiometricEventsService.discard()`:
   - Validar `estado_resolucion = POTENCIAL_DUPLICADO` → 409 si no
   - Transición → `DUPLICADO`
   - Registrar en `registros_auditoria` (accion = 'DESCARTE_DUPLICADO')
   - Trigger recálculo de horas del día afectado
4. Implementar `BiometricEventsService.confirmValid()`:
   - Validar `estado_resolucion = POTENCIAL_DUPLICADO` → 409 si no
   - Transición → `RESUELTO`, `evento_referencia_id = null`
   - Registrar en `registros_auditoria` (accion = 'CONFIRMACION_VALIDO_DUPLICADO')
5. Implementar `GET /biometric-events` con filtros (colaborador_id, fechas, estado).
6. Integration tests: discard flujo completo, confirm flujo completo, 403 por rol, 409 estado incorrecto.

### Fase D — Integración con Cálculo de Horas (spec 006)

1. Actualizar la query de cálculo de horas en spec 006 para incluir `POTENCIAL_DUPLICADO` (ya está en cálculos) y excluir `DUPLICADO`.
   - Cambio: `estado_resolucion IN ('RESUELTO', 'POTENCIAL_DUPLICADO')`
2. Implementar el trigger de recálculo en `BiometricEventsService.discard()`:
   - Identificar la semana laboral del día afectado (por checktime)
   - Recalcular horas del día → actualizar `LiquidacionSemanal` BORRADOR si existe
   - Si el recálculo genera par inconsistente (dos entradas sin salida) → incluir advertencia en el response
3. Tests: verificar que el total de horas se actualiza tras el descarte; verificar que advertencia se genera en par inconsistente.

### Fase E — Frontend: Historial con Marcado Visual

1. Extender la vista de historial de asistencia (`/asistencia/[colaboradorId]/page.tsx`):
   - Obtener eventos via `GET /biometric-events` con filtros
   - Mostrar `DuplicateStatusChip` en filas con `estado_resolucion = POTENCIAL_DUPLICADO | DUPLICADO`
   - Resaltar visualmente filas POTENCIAL_DUPLICADO (MUI: color de fondo amarillo/naranja, Chip "Potencial Duplicado")
   - Para DUPLICADO: fila atenuada + Chip "Descartado"
2. Implementar `DuplicateFilterChip`: filtros Todos / Potencial Duplicado / Descartado.
3. Implementar `DuplicateActionModal`:
   - Título dinámico: "Descartar evento" / "Confirmar como válido"
   - Campo de justificación (React Hook Form + Zod, min 5 chars)
   - Mostrar referencia al evento original (fecha/hora)
   - Advertencia si el descarte generó par inconsistente (desde el response del PATCH)
4. Condicionar botones de acción a rol: visible solo para ADMINISTRADOR, SUPERVISOR, CAJERO.
5. Unit tests: AttendanceEventRow render con distintos estados; modal validación de justificación; botones visibles solo para roles correctos.

## Complexity Tracking

| Decisión | Por qué necesaria | Alternativa rechazada |
|----------|------------------|-----------------------|
| Extender EstadoResolucion (vs. campo booleano separado) | Mantiene toda la información de estado del evento en un campo indexado; queries de cálculo ya filtran por este campo | Campo booleano: requiere queries compuestas y estado ambiguo RESUELTO+booleano |
| Campo tipo_evento en EventoBiometricoDesglosado | La detección por tipo requiere un campo indexable extraído del payload | Parsear payload_completo en runtime: no indexable, viola SRP |
| Detección sincrónica en pipeline | Escala de 50 eventos/turno no justifica cola async; la latencia de ~50ms es aceptable | Cola async: añade complejidad operacional innecesaria para el volumen del MVP |
| CAJERO autorizado para descartar | Requerimiento explícito de FR-008 y clarificación del usuario | No incluir CAJERO: violaría el requerimiento funcional |
