# Data Model: Gestión de Liquidación Semanal

**Feature**: 006-weekly-payroll | **Date**: 2026-05-25

**Base Model Reference**: `specs/003-mvp-data-model/data-model.md` v2.0 (APROBADO)

> Esta feature no introduce nuevas tablas al modelo base — todas las entidades necesarias
> fueron incorporadas en la enmienda v2.0 del modelo base (spec 003). Este documento detalla
> qué campos lee y escribe cada operación de spec 006, y las invariantes de negocio
> impuestas a nivel de servicio.

---

## Entidades Involucradas

### `liquidaciones_semanales` — Leer y Escribir

Spec 006 es la propietaria funcional de este ciclo de vida de estado.

| Campo | R/W | Responsable | Notas |
|-------|-----|-------------|-------|
| `id` | R | — | PK |
| `colaborador_id` | R | — | FK → `colaboradores.id` |
| `semana_id` | R | — | FK → `semanas_laborales.id` |
| `horas_ordinarias` | R/W | `LiquidacionCalculatorService` | Recalculado en cada mutación de `dias_liquidacion` |
| `horas_extra` | R/W | `LiquidacionCalculatorService` | Recalculado ídem |
| `valor_horas_ordinarias` | R/W | `LiquidacionCalculatorService` | `Σ(min(horas_dia, umbral) × tarifa_efectiva_dia)` |
| `valor_horas_extra` | R/W | `LiquidacionCalculatorService` | `Σ(max(horas_dia − umbral, 0) × tarifa_extra)` |
| `total_bonos` | R/W | `LiquidacionCalculatorService` | `Σ bonos.monto` del período |
| `total_descuentos` | R/W | `LiquidacionCalculatorService` | `Σ descuento_valor` donde `descuento_tipo = MONTO_FIJO` por día |
| `total_pago` | R/W | `LiquidacionCalculatorService` | `valor_horas_ordinarias + valor_horas_extra + total_bonos − total_descuentos` |
| `estado` | R/W | Spec 001 (BORRADOR) / Spec 006 (APROBADO) | `BORRADOR → APROBADO` |
| `aprobado_por` | W | `POST /liquidaciones/:id/aprobar` | UUID del usuario que aprueba |
| `aprobada_en` | W | `POST /liquidaciones/:id/aprobar` | Timestamp de aprobación |
| `pagado_por` | — | Spec 007 | Fuera del alcance de spec 006 |
| `pagada_en` | — | Spec 007 | Fuera del alcance de spec 006 |
| `configuracion_reglas_ids` | W | `LiquidacionCalculatorService` | Array de UUIDs de reglas vigentes usadas en el cálculo; requerido por Principio IV |
| `calculado_en` | W | `LiquidacionCalculatorService` | Timestamp del último recálculo |

**Estado enum** (`EstadoLiquidacion`): `BORRADOR | APROBADO | PAGADO`
- Spec 006 solo transiciona de `BORRADOR` → `APROBADO`
- Una liquidación en `APROBADO` o `PAGADO` es inmutable para spec 006

**Constraint de unicidad**: `UNIQUE(colaborador_id, semana_id)` — garantizado por DB y verificado antes de insertar.

---

### `dias_liquidacion` — Leer y Escribir

El pipeline de spec 001 inserta/actualiza estas filas al procesar marcajes biométricos.
Spec 006 las lee para la vista y escribe los ajustes del supervisor.

| Campo | R/W | Quién escribe | Notas |
|-------|-----|---------------|-------|
| `id` | R | — | PK |
| `liquidacion_id` | R | — | FK → `liquidaciones_semanales.id` |
| `fecha` | R | Spec 001 | Fecha del día (DATE) |
| `horas_calculadas` | R | Spec 001 | Calculado desde biométricos; NUNCA modificado por spec 006 |
| `horas_ajustadas_supervisor` | R/W | Spec 006 supervisor | `null` = sin ajuste; valor ≥ 0 reemplaza `horas_calculadas` para el pago |
| `atraso_detectado` | R | Spec 001 | Booleano calculado desde horario configurado vs checktime de entrada |
| `estado_dia` | W | Spec 006 (derivado) | Derivado por backend: ver Decision 3 en research.md |
| `motivo_ajuste` | W | Spec 006 supervisor | Texto libre; requerido si `horas_ajustadas_supervisor IS NOT NULL` |
| `descuento_tipo` | W | Spec 006 supervisor | `TARIFA_DIA | MONTO_FIJO | null` |
| `descuento_valor` | W | Spec 006 supervisor | Tarifa reducida (bs/h) si `TARIFA_DIA`; importe fijo (bs) si `MONTO_FIJO`; null si sin descuento |
| `descuento_motivo` | W | Spec 006 supervisor | Texto libre; requerido si `descuento_tipo IS NOT NULL` |

**Enums**: `EstadoDia { SIN_REVISION, APROBADO, CON_AJUSTE_HORAS, CON_DESCUENTO, CON_AJUSTE_Y_DESCUENTO }`
`TipoDescuentoDia { TARIFA_DIA, MONTO_FIJO }`

**Derivación de `estado_dia`** (backend-only, nunca enviado por el cliente):
- `horas_ajustadas IS NOT NULL` AND `descuento_tipo IS NOT NULL` → `CON_AJUSTE_Y_DESCUENTO`
- `descuento_tipo IS NOT NULL` (solo descuento) → `CON_DESCUENTO`
- `horas_ajustadas IS NOT NULL` (solo ajuste de horas) → `CON_AJUSTE_HORAS`
- Aprobación explícita sin ajuste → `APROBADO`
- Sin modificaciones → `SIN_REVISION`

**Constraint**: `UNIQUE(liquidacion_id, fecha)` — un registro por colaborador × día × semana.

**Invariantes de negocio** (enforced en `LiquidacionesService.assertEditable()`):
- Si `liquidacion.estado = APROBADO`: rechazar todo PATCH con 409.
- Si `descuento_tipo IS NOT NULL` → `descuento_motivo` requerido.
- Si `horas_ajustadas_supervisor IS NOT NULL` → `motivo_ajuste` requerido.
- `descuento_valor` debe ser > 0 si `descuento_tipo IS NOT NULL`.
- Si `descuento_tipo = TARIFA_DIA`: `descuento_valor` es una tarifa en bs/h, debe ser ≤ tarifa_configurada_del_dia (reducción, no incremento).

---

### `bonos` — Leer y Escribir

Los bonos son completamente discrecionales: el supervisor define el monto libremente (sin tarifa preconfigurada) y un comentario obligatorio para cualquier tipo.

| Campo | R/W | Quién escribe | Notas |
|-------|-----|---------------|-------|
| `id` | R | — | PK |
| `colaborador_id` | W | Spec 006 supervisor | FK → `colaboradores.id` |
| `semana_id` | W | Spec 006 supervisor | FK → `semanas_laborales.id` |
| `fecha_dia` | W | Spec 006 supervisor | DATE — día específico dentro del período |
| `tipo` | W | Spec 006 supervisor | `TRANSPORTE \| ALIMENTACION \| GENERICO` |
| `monto` | W | Spec 006 supervisor | Decimal > 0 (bs); ingresado libremente, sin tarifa preconfigurada |
| `comentario` | W | Spec 006 supervisor | Texto libre; **requerido para todos los tipos** (no solo GENERICO) |
| `aprobado_por` | W | Spec 006 supervisor | FK → `usuarios.id` — quien crea el bono |
| `creado_en` | W | DB default | — |

> **Nota**: El campo se nombra `comentario` (no `justificacion`). Si el modelo base (spec 003) tiene `justificacion`, aplicar migración de renombre. `aplicado_por_criterio` no aplica a spec 006 (todos los bonos son manuales).

**Enums**: `TipoBono { TRANSPORTE, ALIMENTACION, GENERICO }`

**Constraint de unicidad**: `UNIQUE(colaborador_id, fecha_dia, tipo)` — un bono por tipo por día.

**Invariante de negocio**: Si ya existe un bono con `(colaborador_id, fecha_dia, tipo)`, rechazar el POST con 409 y devolver el ID del bono existente para que el frontend dirija la edición.

---

### `configuraciones_reglas` — Solo Lectura

Spec 006 lee las reglas vigentes para cada colaborador y semana al calcular el pago.
Nunca escribe en esta tabla.

| `tipo` usado | `clave` esperada | Descripción |
|--------------|------------------|-------------|
| `TARIFA_HORA` | `valor` | Tarifa horaria base (bs/h) |
| `MULTIPLICADOR_HORA_EXTRA` | `valor` | Multiplicador para horas extra (decimal; ej. 1.5). Si no existe, default = 1.5 |
| `UMBRAL_HORA_EXTRA` | `valor` | Horas/día a partir del cual el excedente es extra |
| `ASISTENCIA_MINIMA` | `valor` | Porcentaje mínimo de asistencia (advertencia informativa) |

> **Nota**: `TARIFA_HORA_EXTRA` como tarifa fija independiente fue descartado. La tarifa de hora extra se calcula como `tarifa_efectiva_dia × MULTIPLICADOR_HORA_EXTRA` (ver Decision 8 en research.md).

**Resolución de tarifa efectiva por día** (para `LiquidacionCalculatorService`):
1. Buscar regla con `aplica_a = COLABORADOR` y `colaborador_id = <id>` vigente en `fecha_dia`.
2. Si no existe → buscar regla con `aplica_a = GLOBAL` vigente en `fecha_dia`.
3. Si `dias_liquidacion.descuento_tipo = TARIFA_DIA` → usar `descuento_valor` como tarifa efectiva para ese día (reemplaza resultado de pasos 1–2).
4. `tarifa_extra_dia = tarifa_efectiva_dia × multiplicador_hora_extra` (regla `MULTIPLICADOR_HORA_EXTRA` del colaborador o global; default 1.5 si no existe).

Los UUIDs de las reglas usadas se almacenan en `liquidaciones_semanales.configuracion_reglas_ids` para reproducibilidad futura (Principio IV).

---

### `semanas_laborales` — Solo Lectura

Spec 006 lee `fecha_inicio` y `fecha_fin` para determinar los días del período.
El ciclo sábado–viernes está configurado en esta entidad.

---

### `registros_auditoria` — Solo Escritura

Toda mutación en spec 006 genera un `INSERT` en `registros_auditoria` vía `AuditService`.

| Campo | Valor típico |
|-------|-------------|
| `accion` | `DIA_HORAS_AJUSTADAS` \| `DIA_DESCUENTO_APLICADO` \| `DIA_APROBADO` \| `BONO_CREADO` \| `BONO_EDITADO` \| `BONO_ELIMINADO` \| `LIQUIDACION_APROBADA` |
| `entidad_tipo` | `DiaLiquidacion` \| `Bono` \| `LiquidacionSemanal` |
| `entidad_id` | UUID de la entidad modificada |
| `datos_anteriores` | Snapshot JSON antes de la mutación |
| `datos_nuevos` | Snapshot JSON después de la mutación |
| `usuario_id` | UUID del supervisor o administrador (del JWT payload) |
| `ip_origen` | `x-forwarded-for` o `req.ip` |
| `creado_en` | `NOW()` |

---

## Fórmula de Cálculo (Principio IV — reproducibilidad)

```
Para cada día del período:
  horas_efectivas_dia  = horas_ajustadas_supervisor ?? horas_calculadas
  tarifa_efectiva_dia  = (descuento_tipo = TARIFA_DIA)
                           ? descuento_valor
                           : tarifa_configurada(colaborador_id, fecha_dia)
  multiplicador        = ConfiguracionRegla[MULTIPLICADOR_HORA_EXTRA] ?? 1.5
  tarifa_extra_dia     = tarifa_efectiva_dia × multiplicador
  horas_ordinarias_dia = min(horas_efectivas_dia, UMBRAL_HORA_EXTRA)
  horas_extra_dia      = max(horas_efectivas_dia - UMBRAL_HORA_EXTRA, 0)
  descuento_fijo_dia   = (descuento_tipo = MONTO_FIJO) ? descuento_valor : 0
  pago_dia = (horas_ordinarias_dia × tarifa_efectiva_dia)
           + (horas_extra_dia      × tarifa_extra_dia)
           - descuento_fijo_dia

Totales del período:
  horas_ordinarias     = Σ horas_ordinarias_dia
  horas_extra          = Σ horas_extra_dia
  valor_horas_ordinarias = Σ (horas_ordinarias_dia × tarifa_efectiva_dia)
  valor_horas_extra    = Σ (horas_extra_dia × tarifa_extra_dia)
  total_bonos          = Σ bonos.monto (del período)
  total_descuentos     = Σ descuento_fijo_dia (solo MONTO_FIJO)
  total_pago           = valor_horas_ordinarias + valor_horas_extra
                       + total_bonos - total_descuentos
```

> La fórmula es el único código de cálculo autorizado. Vive en `LiquidacionCalculatorService`.
> La UI puede mostrar valores optimistas derivados de esta misma fórmula, pero los valores
> persisted en DB siempre provienen del servicio backend.

---

## Migraciones Requeridas

La enmienda v2.0 del modelo base (spec 003, commit `149e72e`) incluye la mayoría de las entidades.
Sin embargo, las clarificaciones de sesión 2026-05-27 identifican los siguientes cambios de schema:

| Cambio | Tabla | Tipo |
|--------|-------|------|
| Añadir valor `CON_AJUSTE_Y_DESCUENTO` al enum `EstadoDia` | `dias_liquidacion` | Enum amendment |
| Renombrar `justificacion` → `comentario` y hacer NOT NULL para todos los tipos | `bonos` | Column rename + constraint |
| Eliminar constraint de `comentario` solo para GENERICO (ahora aplica a todos) | `bonos` | Constraint update |

**Prerequisito**: Verificar que las migraciones de spec 003 v2.0 estén aplicadas y aplicar las migraciones anteriores antes de implementar spec 006.
