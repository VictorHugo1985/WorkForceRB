# Research: Reporte de Horas Trabajadas

**Feature**: 025-worked-hours-report | **Date**: 2026-11-18

No quedaron `NEEDS CLARIFICATION`. Este documento resume las decisiones técnicas tomadas a partir del código y de los datos reales.

## R1. Fuente de datos y cálculo en el momento (sin tablas nuevas)

- **Decision**: Calcular el reporte en el momento de cada consulta, a partir de `eventos_biometricos_desglosados` unido con `codigos_colaborador` (`codigo_biometrico = employee_workno AND activo`), con una sola consulta por período. No se crean tablas, vistas ni migraciones.
- **Rationale**: FR-006 exige usar solo marcaciones. La medición real fue: un año completo (~20 000 marcaciones) se trae en ~1,1 s desde fuera de la región; el emparejamiento en memoria es lineal y despreciable. Esto cumple SC-001/SC-002 (< 5 s). Ya existe el índice `eventos_biometricos_desglosados_checktime_idx`.
- **Alternatives considered**: Vista materializada o tabla de jornadas precalculadas — agrega mantenimiento (refresco, consistencia con marcaciones que llegan tarde) sin necesidad con el volumen actual. Se puede reconsiderar si se superan ~200 000 marcaciones por año.

## R2. Reglas de emparejamiento

- **Decision**: Reutilizar la función pura `buildJornadas()` de `apps/web/src/lib/liquidacion-db.ts` (empareja de a dos en orden cronológico; si queda una impar, es incompleta) **sin modificarla y sin pasarle marcaciones excluidas** (`excludedIso = []`). La agrupación por fecha local y el emparejamiento de turnos que cruzan la medianoche (entrada huérfana + primera SALIDA del día siguiente dentro de 12 h) se implementan en una versión por lotes (todos los colaboradores a la vez) dentro del nuevo `lib/horas-trabajadas.ts`, replicando exactamente la lógica de `fetchPunchMap()`.
- **Rationale**: SC-005 pide que las horas coincidan con el cálculo estándar a partir de las marcaciones. Reusar `buildJornadas` garantiza la misma aritmética. `fetchPunchMap` trabaja de a un colaborador (N consultas), por eso hace falta una versión por lotes. **No se lee ninguna tabla de liquidaciones** (`liquidacion_*`), tal como pidió el usuario: solo se reutiliza código de cálculo.
- **Alternatives considered**: Extraer el emparejamiento a un módulo compartido y refactorizar `liquidacion-db.ts` — modifica código existente y en producción (principio II, OCP); se deja como mejora futura. Reescribir `buildJornadas` — duplicaría la aritmética y podría divergir.

## R3. Fecha local

- **Decision**: Fecha y hora local = `checktime + make_interval(hours => utc_offset)`, igual que en `fetchPunchMap`. El rango de la consulta se calcula en fechas locales e incluye un día extra al final (para el cruce de medianoche).
- **Rationale**: Hoy todas las marcaciones tienen `utc_offset = -4`; usar la columna mantiene la coherencia si eso cambia.

## R4. Definición de períodos y tramos

- **Decision**:
  - "Hoy" = fecha local GMT-4.
  - Período: `inicio` = día 1 del mes (actual − 2 / − 5 / − 11); `fin` = hoy.
  - Tramos mensuales: cada mes calendario entre inicio y fin; el mes actual es **parcial**.
  - Tramos semanales: semanas ISO (lunes a domingo) que intersecan el período, **recortadas al período** (la primera puede empezar en el día 1; la última termina hoy y es **parcial**).
  - Tramo **sin datos**: termina antes de la fecha local de la primera marcación del sistema (`MIN(checktime)`).
- **Rationale**: FR-002/FR-003/FR-004/FR-005; recortar las semanas garantiza que el total del período sea idéntico en ambas agrupaciones (FR-007/SC-004).
- **Alternatives considered**: Semanas completas que se extienden fuera del período — rompería SC-004.

## R5. Forma de la respuesta y agregación

- **Decision**: Un solo endpoint devuelve los tramos (columnas) y por colaborador un arreglo alineado de `{ horas, incompletos }` + total. Totales y promedios por columna (FR-010), filtros por área/búsqueda/inactivos y orden se aplican **en el cliente** sobre el resultado ya cargado; cambiar de período o de agrupación vuelve a consultar.
- **Rationale**: ~70 colaboradores × máx. 53 columnas = ~3 700 celdas: liviano. Filtrar en el cliente es instantáneo y evita consultas repetidas.
- **Alternatives considered**: Filtrar en el servidor — consultas extra sin beneficio con este volumen.

## R6. Detalle diario

- **Decision**: Endpoint aparte `GET /api/horas-trabajadas/detalle?colaborador_id&desde&hasta` que devuelve las jornadas por día (primera entrada, última salida, horas, incompleto, pares). Rango máximo 31 días.
- **Rationale**: FR-013; evita mandar el detalle de todos los colaboradores en el reporte principal.

## R7. Acceso

- **Decision**: ADMINISTRADOR y SUPERVISOR, ambos ven a todos los colaboradores. Se reutiliza `checkRoles` / `requirePageRoles` (feature 024) y se agrega `/horas-trabajadas` a `nav-config.ts` (`NAV_ITEMS` + `ROUTE_ROLES`) y su icono en `AppSidebar.tsx`.
- **Rationale**: FR-014 y la aclaración del 2026-11-18. El reporte es solo lectura (FR-015): no hay escrituras ni auditoría.

## R8. Desviación respecto de la constitución (Supervisor)

- **Decision**: El SUPERVISOR ve las horas de todos los colaboradores, no solo de su equipo asignado (principio VIII).
- **Rationale**: Lo decidió el usuario en la aclaración; es coherente con las features 013 (Eventos) y 024 (Evaluaciones). Queda justificado en Complexity Tracking.
