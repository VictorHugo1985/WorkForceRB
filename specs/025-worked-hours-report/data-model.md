# Data Model: Reporte de Horas Trabajadas

**Feature**: 025-worked-hours-report | **Date**: 2026-11-18

**Sin cambios de esquema.** El reporte es de solo lectura y calcula todo en el momento a partir de tablas existentes. No se usa ninguna tabla de liquidaciones.

## Tablas existentes que se leen

| Tabla | Columnas usadas | Uso |
|---|---|---|
| `eventos_biometricos_desglosados` | `checktime`, `utc_offset`, `tipo_evento`, `employee_workno` | Marcaciones (fuente única de horas) |
| `codigos_colaborador` | `codigo_biometrico`, `colaborador_id`, `activo` | Vincula marcación ↔ colaborador (`codigo_biometrico = employee_workno AND activo`) |
| `colaboradores` | `id`, `nombre`, `apellido`, `cedula`, `activo`, `area_id` | Filas del reporte |
| `areas` | `id`, `nombre` | Etiqueta y filtro por área |

Las marcaciones sin código de colaborador activo se ignoran (hoy: 1 de ~20 000).

## Estructuras derivadas (en memoria)

### Marcación local
| Campo | Origen |
|---|---|
| colaborador_id | `codigos_colaborador.colaborador_id` |
| time | `checktime + make_interval(hours => utc_offset)` (fecha y hora local) |
| fecha | `time::date` |
| tipo | `COALESCE(tipo_evento, 'ENTRADA')` |

### Jornada diaria
| Campo | Regla |
|---|---|
| colaborador_id, fecha | Agrupación por colaborador y fecha local |
| pares | `buildJornadas(marcaciones del día, [])` → pares entrada/salida con horas |
| horas | Suma de horas de los pares (2 decimales en el cálculo, 1 al mostrar) |
| primera_entrada / ultima_salida | Hora del primer par / del último par (`HH:MM`) |
| incompleta | Cantidad impar de marcaciones luego del cruce de medianoche |

**Cruce de medianoche** (igual que `fetchPunchMap`): si el día D tiene cantidad impar, su última marcación es ENTRADA y la primera del día D+1 es SALIDA con ≤ 12 h de diferencia, esa SALIDA pasa al día D.

### Tramo
| Campo | Regla |
|---|---|
| key | `YYYY-MM` (mes) o `YYYY-Www` (semana ISO) |
| desde / hasta | Recortados a `[inicio_periodo, hoy]` |
| etiqueta | Mes: "Nov 2026"; semana: "03/11 – 09/11" |
| parcial | `hasta = hoy` y el tramo natural termina después de hoy |
| sin_datos | `hasta < fecha_primera_marcacion_sistema` |

### Celda (colaborador × tramo)
| Campo | Regla |
|---|---|
| horas | Σ horas de las jornadas del colaborador con fecha en `[desde, hasta]` |
| incompletos | Cantidad de jornadas incompletas en el tramo (indicador ⚠, FR-009a) |

**Invariante (SC-004)**: Σ celdas del colaborador por mes = Σ por semana = total del período.

## Validaciones de entrada
- `periodo ∈ {trimestre, semestre, anio}` (default `trimestre`).
- `agrupacion ∈ {mes, semana}` (default `mes`).
- Detalle: `colaborador_id` uuid; `desde ≤ hasta`; rango ≤ 31 días; `hasta ≤ hoy`.
