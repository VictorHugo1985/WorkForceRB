# Data Model: Evaluaciones del Personal

**Feature**: 024-staff-evaluations | **Date**: 2026-11-18

Extensión modular del esquema: 3 tablas nuevas y ninguna alteración a tablas existentes (principio I).

```text
colaboradores (existente) 1 ──── * evaluaciones * ──── 1 usuarios (evaluador / anulador)
                                       │
                                       1
                                       │
                                       * evaluacion_detalles * ──── 1 criterios_evaluacion
```

## criterios_evaluacion

Catálogo global de criterios ponderados (configurable por ADMINISTRADOR).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | UUID | PK, default `gen_random_uuid()` | |
| nombre | VARCHAR(100) | NOT NULL | Ej. "Puntualidad" |
| descripcion | TEXT | NULL | Opcional |
| peso | NUMERIC(5,2) | NOT NULL, CHECK `peso > 0 AND peso <= 100` | Porcentaje |
| activo | BOOLEAN | NOT NULL, default `true` | |
| creado_en | TIMESTAMPTZ | NOT NULL, default `now()` | |
| actualizado_en | TIMESTAMPTZ | NOT NULL, default `now()` | Se actualiza en cada UPDATE desde la API |

**Índices / unicidad**
- `UNIQUE INDEX ux_criterios_evaluacion_nombre_activo ON criterios_evaluacion (LOWER(nombre)) WHERE activo` → FR-006 (sin duplicados entre activos, sin distinguir mayúsculas/minúsculas).

**Reglas**
- Suma de `peso` de los activos = 100.00 para poder evaluar (FR-005). La API lo valida; no hay restricción en la BD (ver research R4).
- No hay DELETE si el criterio tiene filas en `evaluacion_detalles` (FR-007): la FK es `ON DELETE RESTRICT` y la API solo expone activar/desactivar.

## evaluaciones

Encabezado de cada evaluación. No se modifica después de creada, salvo los campos de anulación.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | UUID | PK | |
| colaborador_id | UUID | NOT NULL, FK → `colaboradores(id)` ON DELETE RESTRICT | Trabajador evaluado |
| evaluador_id | UUID | NOT NULL, FK → `usuarios(id)` | Usuario que registró |
| fecha_evaluacion | DATE | NOT NULL; no futura — se valida en la API con la fecha local GMT-4 (como `todayGMTMinus4` en eventos-biometricos) | Por defecto hoy (FR-012) |
| puntaje_final | NUMERIC(4,2) | NOT NULL, CHECK `BETWEEN 1 AND 10` | Calculado en el servidor (FR-010) |
| comentario | TEXT | NULL, máx. 1000 caracteres (API) | |
| estado | VARCHAR(10) | NOT NULL, default `'VIGENTE'`, CHECK `IN ('VIGENTE','ANULADA')` | |
| motivo_anulacion | TEXT | NULL | Obligatorio si está ANULADA |
| anulada_por | UUID | NULL, FK → `usuarios(id)` | |
| anulada_en | TIMESTAMPTZ | NULL | |
| creado_en | TIMESTAMPTZ | NOT NULL, default `now()` | Fecha y hora de registro |

**Restricciones**
- `CHECK ((estado = 'VIGENTE' AND motivo_anulacion IS NULL AND anulada_por IS NULL AND anulada_en IS NULL) OR (estado = 'ANULADA' AND motivo_anulacion IS NOT NULL AND anulada_por IS NOT NULL AND anulada_en IS NOT NULL))`

**Índices**
- `ix_evaluaciones_colaborador_fecha ON evaluaciones (colaborador_id, fecha_evaluacion DESC, creado_en DESC)` → histórico (SC-004) y agregados de la pantalla principal.

**Transiciones de estado**

```text
VIGENTE ──(ADMINISTRADOR anula + motivo)──▶ ANULADA   (terminal, irreversible)
```

## evaluacion_detalles

Puntaje por criterio, con copia (snapshot) del nombre y el peso (FR-011, research R3).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id | UUID | PK | |
| evaluacion_id | UUID | NOT NULL, FK → `evaluaciones(id)` ON DELETE CASCADE | |
| criterio_id | UUID | NOT NULL, FK → `criterios_evaluacion(id)` ON DELETE RESTRICT | Trazabilidad |
| criterio_nombre | VARCHAR(100) | NOT NULL | Copia del nombre al evaluar |
| peso | NUMERIC(5,2) | NOT NULL | Copia del peso al evaluar |
| puntaje | SMALLINT | NOT NULL, CHECK `BETWEEN 1 AND 10` | Escala 1–10 (FR-009) |

**Unicidad**: `UNIQUE (evaluacion_id, criterio_id)`.

**Regla**: una evaluación tiene exactamente un detalle por cada criterio activo al momento de registrar (lo valida la API usando `config_version`).

## Valores derivados (no persistidos)

| Valor | Cálculo |
|---|---|
| Suma de pesos activos | `SUM(peso) FROM criterios_evaluacion WHERE activo` |
| `config_version` | SHA-256 de `id:nombre:peso` de los criterios activos ordenados por `id`, unidos con `|` |
| Promedio del trabajador | `ROUND(AVG(puntaje_final), 2) WHERE estado = 'VIGENTE'` (FR-016, FR-019) |
| Última evaluación | `MAX(fecha_evaluacion) WHERE estado = 'VIGENTE'` |

## Auditoría (`registros_auditoria`, existente)

| accion | entidad_tipo | entidad_id | datos_anteriores / datos_nuevos |
|---|---|---|---|
| CRITERIO_EVALUACION_CREADO | CriterioEvaluacion | criterio.id | — / fila nueva |
| CRITERIO_EVALUACION_ACTUALIZADO | CriterioEvaluacion | criterio.id | fila previa / fila nueva (incluye activar/desactivar) |
| CRITERIO_EVALUACION_PESOS_ACTUALIZADOS | CriterioEvaluacion | NULL | `[{id, peso}]` previos / nuevos |
| EVALUACION_REGISTRADA | Evaluacion | evaluacion.id | — / encabezado + detalles |
| EVALUACION_ANULADA | Evaluacion | evaluacion.id | `{estado:'VIGENTE'}` / `{estado:'ANULADA', motivo}` |
