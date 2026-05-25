# Implementation Plan: Gestión de Liquidación Semanal

**Branch**: `006-weekly-payroll` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)

## Summary

Implementar el módulo de revisión, ajuste y aprobación de liquidaciones semanales para los roles
ADMINISTRADOR y SUPERVISOR. El supervisor selecciona un colaborador y una semana, revisa las horas
calculadas por día desde biométricos (pre-cargadas por spec 001), aplica ajustes de horas o
descuentos diarios (tarifa reducida o monto fijo), asigna bonos por día, y aprueba la liquidación.
Un `LiquidacionCalculatorService` centraliza toda la aritmética de pago (Principio IV). Las
liquidaciones aprobadas son inmutables. Toda mutación queda registrada en `registros_auditoria`.

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**:
- NestJS — framework base (`apps/api`)
- Prisma (`@workforce/database`) — ORM sobre PostgreSQL; todas las entidades en spec 003 v2.0
- `class-validator` + Zod + `nestjs-zod` — validación de DTOs
- `@nestjs/swagger` — documentación de endpoints
- `@nestjs/jwt` / `JwtAuthGuard` — autenticación (spec 005, prerequisito)
- Next.js 14 (App Router) — `apps/web` (vistas de revisión de liquidación)
- MUI v5 (Material UI 5.15) + Emotion 11 — DataGrid para tabla de días, dialogs de ajuste
- React Hook Form + Zod — formularios de ajuste/bono
- Axios — HTTP desde frontend
- Zustand — estado global de la liquidación activa en el frontend

**Storage**: PostgreSQL vía Prisma. Sin migraciones nuevas — todas las entidades necesarias
están en la enmienda v2.0 del modelo base (spec 003, commit `149e72e`):
- `liquidaciones_semanales` (con `horas_ordinarias`, `horas_extra`, totales, `estado`, `configuracion_reglas_ids`)
- `dias_liquidacion` (con `horas_ajustadas_supervisor`, `descuento_tipo/valor/motivo`, `estado_dia`)
- `bonos` (con `fecha_dia`, `GENERICO` en `TipoBono`)
- `configuraciones_reglas`, `semanas_laborales`, `registros_auditoria`

**Testing**: Jest (unit: `LiquidacionCalculatorService`, `LiquidacionesService`);
supertest (integration: flujo completo revisar → ajustar → aprobar → intentar modificar)

**Target Platform**: NestJS server (`apps/api`) + Browser (`apps/web`)

**Performance Goals**:
- PATCH /dias-liquidacion responde con totales recalculados en < 200ms (local); < 2s end-to-end (SC-002)
- GET /liquidaciones con 7 días + bonos en < 500ms
- Optimistic UI update: el frontend muestra totales inmediatamente antes de recibir respuesta del backend

**Constraints**:
- Solo ADMINISTRADOR y SUPERVISOR pueden gestionar liquidaciones; scope de SUPERVISOR limitado a su equipo
- Liquidación aprobada es inmutable (FR-009); 409 en cualquier intento de mutación post-aprobación
- `LiquidacionCalculatorService` es la única implementación de la fórmula (Principio IV)
- No hay migraciones nuevas: todas las entidades existen en spec 003 v2.0
- La creación del BORRADOR (FR-010) es interna al backend, llamada por spec 001; no es un endpoint HTTP

**Scale/Scope**: ~10 usuarios, ~20 colaboradores, una semana activa, MVP

## Constitution Check

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Arquitectura Basada en Datos | ✅ | Todas las entidades en modelo base v2.0 (spec 003); no hay migraciones pendientes |
| II. Código Limpio y Modular | ✅ | `LiquidacionesModule` independiente; `LiquidacionCalculatorService` de responsabilidad única |
| IV. Cálculo Determinístico y Auditable | ✅ | Fórmula única en `LiquidacionCalculatorService`; `configuracion_reglas_ids` persiste reglas usadas; log de auditoría completo |
| V. Reglas de Negocio Configurables | ✅ | Tarifa, umbral de hora extra y mínimo de asistencia leídos desde `configuraciones_reglas` |
| VIII. RBAC | ✅ | Solo ADMINISTRADOR y SUPERVISOR; scope de SUPERVISOR verificado por servicio |
| IX. Trazabilidad Obligatoria | ✅ | FR-011: todo ajuste en `registros_auditoria` con antes/después, usuario e IP |
| XI. Seguridad | ✅ | `JwtAuthGuard` en todos los endpoints; verificación de scope; mutación post-aprobación bloqueada |

## Project Structure

### Documentation (this feature)

```text
specs/006-weekly-payroll/
├── plan.md          ← este archivo
├── research.md      ← 7 decisiones técnicas (calculadora, API shape, audit, optimistic UI...)
├── data-model.md    ← entidades leídas/escritas; invariantes de negocio; fórmula de cálculo
├── contracts/
│   └── api.md       ← GET /liquidaciones, PATCH /dias-liquidacion/:id, POST/PATCH/DELETE /bonos, POST /liquidaciones/:id/aprobar
└── tasks.md         ← (generado por /speckit-tasks)
```

### Source Code

```text
apps/api/
├── src/
│   └── liquidaciones/
│       ├── liquidaciones.module.ts
│       ├── liquidaciones.controller.ts      # 5 endpoints + scope guard
│       ├── liquidaciones.controller.spec.ts
│       ├── liquidaciones.service.ts         # findOrCreateBorrador, assertEditable, assertScope
│       ├── liquidaciones.service.spec.ts
│       ├── services/
│       │   ├── liquidacion-calculator.service.ts   # Fórmula única FR-008
│       │   ├── liquidacion-calculator.service.spec.ts
│       │   └── audit-liquidacion.service.ts        # Wrapper de AuditService para acciones de liquidación
│       └── dto/
│           ├── liquidacion-response.dto.ts
│           ├── patch-dia-liquidacion.dto.ts
│           ├── create-bono.dto.ts
│           └── patch-bono.dto.ts

apps/web/
├── src/
│   ├── app/
│   │   └── (app)/
│   │       └── liquidaciones/
│   │           └── [semanaId]/
│   │               └── [colaboradorId]/
│   │                   └── page.tsx              # Página principal de revisión de liquidación
│   └── components/liquidaciones/
│       ├── DiaLiquidacionTable.tsx               # MUI DataGrid de días del período
│       ├── DiaAjusteDialog.tsx                   # Dialog para ajuste de horas + descuento
│       ├── BonoSectionPanel.tsx                  # Panel de bonos con add/edit/delete
│       ├── LiquidacionSummaryCard.tsx            # Card de totales con actualización optimista
│       └── AprobarLiquidacionButton.tsx          # Botón de aprobación con confirmación
```

**Structure Decision**: Monorepo (apps/api + apps/web). `LiquidacionesModule` en módulo propio en el backend, aislado del `AuthModule`. El cálculo vive en `LiquidacionCalculatorService` que es inyectable y testeable independientemente del controller. El frontend usa un Zustand store para el estado de la liquidación activa, con actualizaciones optimistas por acción.

## Implementation Phases

### Fase A — Backend: LiquidacionesModule + Calculadora

1. Crear `LiquidacionesModule` con imports de `PrismaModule` y export de `LiquidacionesService`.
2. Implementar `LiquidacionCalculatorService`:
   - `calcularTotales(liquidacionId)`: lee todos los `DiaLiquidacion` + `bonos` del período,
     resuelve tarifas desde `configuraciones_reglas` (por colaborador o global), aplica la fórmula
     de FR-008, persiste los totales en `liquidaciones_semanales`, registra `configuracion_reglas_ids`
     y `calculado_en`.
   - `resolveTarifaEfectiva(colaboradorId, fechaDia, descuento)`: resolución de tarifa con fallback global.
   - `deriveEstadoDia(dia)`: determina `estado_dia` derivado de los campos presentes (Decision 3 en research.md).
3. Implementar `LiquidacionesService`:
   - `findOrCreateBorrador(colaboradorId, semanaId)`: idempotente — busca o crea.
   - `getLiquidacion(colaboradorId, semanaId)`: consulta con dias + bonos embebidos.
   - `assertEditable(liquidacionId)`: lanza 409 si `estado = APROBADO`.
   - `assertScope(usuarioId, roles, colaboradorId)`: valida scope del SUPERVISOR.
   - `patchDiaLiquidacion(id, dto)`: actualiza campos, deriva `estado_dia`, llama calculadora.
   - `createBono(dto)`: verifica unicidad (colaborador × fechaDia × tipo), inserta, recalcula.
   - `patchBono(id, dto)`: actualiza monto/justificacion, recalcula.
   - `deleteBono(id)`: elimina, recalcula.
   - `aprobarLiquidacion(id, usuarioId)`: UPDATE `estado = APROBADO`, `aprobado_por`, `aprobada_en`.
4. Unit tests para `LiquidacionCalculatorService` (casos: días con ajuste de horas, con descuento TARIFA_DIA, con descuento MONTO_FIJO, ambos coexistiendo, días ausentes, horas extra).

### Fase B — Backend: Controller y Validación

1. Definir DTOs con `class-validator`:
   - `PatchDiaLiquidacionDto`: campos opcionales con validaciones cruzadas (motivo requerido si ajuste, descuentoValor+Motivo requeridos si tipo).
   - `CreateBonoDto`: campos con enum `TipoBono`, justificación condicional para GENERICO.
   - `PatchBonoDto`: partial de CreateBonoDto.
2. Implementar `LiquidacionesController`:
   - `GET /liquidaciones` — `@UseGuards(JwtAuthGuard)` + `@Roles('ADMINISTRADOR', 'SUPERVISOR')`
   - `PATCH /dias-liquidacion/:id` — ídem + assertEditable + assertScope
   - `POST /bonos` — ídem
   - `PATCH /bonos/:id` — ídem
   - `DELETE /bonos/:id` — ídem
   - `POST /liquidaciones/:id/aprobar` — ídem
3. Añadir decoradores Swagger (`@ApiTags`, `@ApiOperation`, `@ApiResponse`) en todos los endpoints.
4. Integration tests (supertest): flujo completo por user story (ver contratos/api.md).

### Fase C — Backend: Auditoría (FR-011)

1. Verificar que existe `AuditService` (o implementarlo si spec 005 no lo expuso aún) con método
   `log(accion, entidadTipo, entidadId, datosAnteriores, datosNuevos, usuarioId, ip)`.
2. Envolver cada mutación en `LiquidacionesService` con llamadas a `AuditService.log()` usando
   los códigos de acción definidos en `data-model.md` (`DIA_HORAS_AJUSTADAS`, `BONO_CREADO`, etc.).
3. La integración con spec 001 (FR-010): exponer `LiquidacionesService.findOrCreateBorrador()` como método inyectable; documentar que spec 001 lo llama sin HTTP.

### Fase D — Frontend: Página de Revisión de Liquidación

1. Crear Zustand store `useLiquidacionStore`:
   - `liquidacion` (estado completo con dias + bonos + totales)
   - `setLiquidacion(data)` — carga inicial
   - `applyOptimisticTotales(totales)` — actualización optimista
   - `reconcileTotales(totales)` — corrección desde respuesta del backend
   - `applyOptimisticDia(dia)` — actualización optimista del día
2. Crear `DiaLiquidacionTable`:
   - MUI DataGrid con columnas: Fecha, Entrada registrada, Horas calculadas, Horas ajustadas,
     Atraso, Tarifa efectiva, Pago día, Descuento, Estado, Acciones.
   - Cada fila muestra indicadores visuales: `Chip` de atraso, `Badge` de descuento, estado con color.
   - Botón "Ajustar" abre `DiaAjusteDialog`.
3. Crear `DiaAjusteDialog` (MUI Dialog):
   - React Hook Form + Zod para ajuste de horas + descuento.
   - Campos: horas ajustadas (NumberField), motivo ajuste (TextField), descuentoTipo (Select),
     descuentoValor (NumberField), descuentoMotivo (TextField), aprobar sin ajuste (Checkbox).
   - On submit: `PATCH /dias-liquidacion/:id` → update optimista → reconciliar con respuesta.
4. Crear `BonoSectionPanel`:
   - Lista de bonos agrupados por día con montos.
   - Botón "Agregar bono" → form inline: día (DatePicker dentro del período), tipo (Select), monto, justificación.
   - Editar/Eliminar con confirmación.
   - `POST /bonos` → `PATCH /bonos/:id` → `DELETE /bonos/:id`.
5. Crear `LiquidacionSummaryCard`:
   - Muestra: horas ordinarias, horas extra, valor horas ordinarias, valor horas extra,
     total bonos, total descuentos, **total a pagar**.
   - Se actualiza desde el store con cada mutación (optimista + reconciliación).
   - Estado de la liquidación (`Chip` con color: BORRADOR=warning, APROBADO=success).
6. Crear `AprobarLiquidacionButton`:
   - MUI Button con Dialog de confirmación.
   - On confirm: `POST /liquidaciones/:id/aprobar` → actualiza store → deshabilita todos los controles de edición.
7. Crear `page.tsx` en `app/(app)/liquidaciones/[semanaId]/[colaboradorId]/page.tsx`:
   - Server component: llama `GET /liquidaciones` → pasa datos al cliente.
   - Renderiza `DiaLiquidacionTable`, `BonoSectionPanel`, `LiquidacionSummaryCard`, `AprobarLiquidacionButton`.

## Complexity Tracking

| Decisión | Por qué necesaria | Alternativa rechazada |
|----------|------------------|-----------------------|
| `LiquidacionCalculatorService` centralizado | Principio IV: reproducibilidad del cálculo; una sola fuente de verdad para la fórmula | Cálculo en controller o en múltiples lugares: riesgo de divergencia |
| Optimistic UI update con reconciliación | SC-002 (< 2s) sin degradar experiencia; backend a < 200ms local hace que el diff sea imperceptible | Esperar respuesta del backend antes de actualizar UI: loading spinner en cada acción |
| `estado_dia` derivado por backend (no enviado por cliente) | Previene estados inválidos; simplifica el cliente; centraliza la lógica de derivación | Cliente envía `estadoDia` directamente: riesgo de inconsistencia si el cliente tiene lógica diferente |
| `findOrCreateBorrador` inyectable (no endpoint HTTP) | FR-010 es disparado por spec 001 dentro del mismo proceso NestJS; HTTP overhead innecesario | Endpoint interno: añade latencia y manejo de errores HTTP sin beneficio |
| `configuracion_reglas_ids` en JSON | Principio IV: permite recalcular el pago de cualquier semana cerrada con las reglas que estaban vigentes en ese momento | No persistir IDs: pérdida de reproducibilidad si las reglas cambian |
