# Research: Evaluaciones del Personal

**Feature**: 024-staff-evaluations | **Date**: 2026-11-18

No quedaron `NEEDS CLARIFICATION` en el Technical Context. Esta investigación documenta las decisiones de diseño tomadas a partir del código existente.

## R1. Capa de implementación

- **Decision**: Implementar toda la feature en `apps/web` (Next.js 16 App Router): Route Handlers en `src/app/api/...` con `pg` Pool directo (`pool` de `@/lib/auth-server`) y validación con `zod`.
- **Rationale**: Es el patrón vigente en las features 013–023 (`/api/configuracion/*`, `/api/accesos`, `/api/eventos-biometricos`). `apps/api` (NestJS) no se usa para los módulos nuevos.
- **Alternatives considered**: Endpoint en NestJS + `api-proxy.ts` — descartado porque añade una capa que los módulos recientes ya no usan.

## R2. Migración de base de datos

- **Decision**: Un script SQL `specs/024-staff-evaluations/migration.sql` (up) y `migration-down.sql` (down), ejecutados manualmente en el SQL Editor de Supabase. Se agregan además los modelos a `apps/api/prisma/schema.prisma` solo como documentación del esquema.
- **Rationale**: Es lo mismo que hizo la feature 022 (`prisma db push` no funciona por un error que ya existía en el schema). La constitución (XI) exige migraciones reversibles, por eso el down va explícito.
- **Alternatives considered**: `prisma migrate` — no está disponible en este repo hoy.

## R3. Copia (snapshot) de criterios en cada evaluación

- **Decision**: La tabla `evaluacion_detalles` guarda `criterio_id` (FK, por trazabilidad) y además `criterio_nombre` y `peso` copiados al momento de evaluar. El `puntaje_final` se calcula en el servidor y se guarda en `evaluaciones`.
- **Rationale**: FR-011/FR-013/SC-003: cambiar el nombre o el peso de un criterio, o desactivarlo, no debe alterar las evaluaciones pasadas. Además el histórico se lee sin recalcular.
- **Alternatives considered**: Versionar la tabla de criterios (vigencia desde/hasta) — más complejo y sin beneficio extra para este caso; la copia por evaluación es suficiente y fácil de auditar.

## R4. Validación de "suma = 100%"

- **Decision**: Los pesos se guardan como `NUMERIC(5,2)`. Los cambios a criterios individuales se permiten aunque la suma deje de ser 100%; la UI muestra la suma en vivo. Hay un endpoint de **guardado masivo de pesos** (`PUT /api/configuracion/criterios-evaluacion/pesos`) que actualiza todos los pesos en una sola transacción y exige que sumen 100.00. El registro de evaluaciones (POST) vuelve a verificar en el servidor que `SUM(peso) WHERE activo = 100.00` y si no, devuelve 409 `CRITERIOS_NO_SUMAN_100`.
- **Rationale**: Si cada edición individual exigiera llegar a 100%, sería imposible reajustar pesos de uno en uno. El guardado masivo permite redistribuir sin pasar por estados inválidos, y el bloqueo al evaluar cumple FR-005.
- **Alternatives considered**: Un trigger en la BD que impida suma ≠ 100 — bloquea las ediciones intermedias y complica desactivar criterios.

## R5. Detección de cambios concurrentes en criterios

- **Decision**: `GET /api/evaluaciones/criterios-vigentes` devuelve los criterios activos junto con un `config_version`: un hash SHA-256 de la lista ordenada `id:nombre:peso` de los criterios activos. El POST de la evaluación envía ese `config_version`; el servidor lo recalcula dentro de la transacción y, si no coincide, responde 409 `CRITERIOS_CAMBIARON`.
- **Rationale**: Es el caso borde que se agregó durante la aclaración. Este hash no necesita columnas ni estado extra y detecta cualquier cambio de nombre, peso, alta o baja de criterios.
- **Alternatives considered**: Columna `version` incremental en una tabla de configuración — obliga a mantener otro registro; usar `MAX(actualizado_en)` — no detecta desactivaciones si no se toca esa columna.

## R6. Cálculo del puntaje final

- **Decision**: `puntaje_final = ROUND(SUM(puntaje × peso / 100), 2)` calculado en el servidor (TypeScript, aritmética en centésimas para evitar errores de coma flotante) y guardado como `NUMERIC(4,2)` (rango 1.00–10.00).
- **Rationale**: FR-010 y SC-002. El servidor es la única fuente del cálculo; el cliente solo muestra una vista previa.

## R7. Control de acceso

- **Decision**:
  - `/configuracion` (y `/api/configuracion/criterios-evaluacion/*`): solo ADMINISTRADOR, con el `checkAdminRole` existente.
  - `/evaluaciones` (página y `/api/evaluaciones/*`): ADMINISTRADOR o SUPERVISOR. Se añade un helper reutilizable `checkRoles(req, roles)` en `auth-server.ts` (generaliza `checkAdminRole`, que pasa a usarlo sin cambiar su firma).
  - Anular una evaluación: solo ADMINISTRADOR.
  - Se agrega `/evaluaciones` a `NAV_ITEMS` y `ROUTE_ROLES` en `nav-config.ts`; `proxy.ts` ya aplica la protección por prefijo.
- **Rationale**: FR-021/FR-022/FR-018 y el principio VIII de la constitución. El helper evita duplicar el bloque de verificación de token que hoy se repite en `eventos-biometricos`.

## R8. Auditoría

- **Decision**: Insertar en `registros_auditoria` en la misma transacción que la operación, con estas acciones: `CRITERIO_EVALUACION_CREADO`, `CRITERIO_EVALUACION_ACTUALIZADO`, `CRITERIO_EVALUACION_PESOS_ACTUALIZADOS`, `EVALUACION_REGISTRADA`, `EVALUACION_ANULADA`. Se guardan `datos_anteriores` y `datos_nuevos` en JSONB.
- **Rationale**: FR-020, principio IX; es el mismo patrón que `colaboradores/[id]/estado`.

## R9. Trabajadores evaluables

- **Decision**: "Trabajador" = fila de `colaboradores`. El buscador de la pantalla principal filtra por `nombre`, `apellido` o `cedula` (ILIKE). Solo los activos se pueden evaluar; el filtro "incluir inactivos" sirve solo para consultar su histórico.
- **Rationale**: Es la entidad existente (supuesto de la spec). La cédula es el "código" visible y único del colaborador.

## R10. Desviación respecto de la constitución (Supervisor)

- **Decision**: El SUPERVISOR puede evaluar y ver el histórico de **cualquier** colaborador, no solo de su equipo asignado.
- **Rationale**: Lo decidió explícitamente el usuario en la aclaración del 2026-11-18. El principio VIII describe al supervisor como "gestión del equipo asignado"; la desviación está justificada en Complexity Tracking del plan.
