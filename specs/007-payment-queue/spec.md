# Feature Specification: Vista de Consolidados Pendientes de Pago

**Feature Branch**: `007-payment-queue`

**Created**: 2026-05-22

**Status**: Draft

## Clarifications

### Session 2026-05-22

- Q: ¿Puede el SUPERVISOR ver (solo lectura) el estado de pago de las liquidaciones de sus colaboradores? → A: Sí; el SUPERVISOR tiene acceso de solo lectura al estado de pago (Pendiente / Pagado) de las liquidaciones de sus colaboradores asignados. No puede marcar pagos ni modificar nada.
- Q: ¿La feature incluye una vista de detalle del consolidado antes de confirmar el pago? → A: Sí; al seleccionar un consolidado el sistema muestra el desglose completo (horas, tarifa, bonos por día, descuentos) antes de ofrecer la acción de confirmar el pago.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consulta de Consolidados Pendientes (Priority: P1)

El administrador (en su rol de cajero) accede a su vista de trabajo y ve la lista de
consolidados de pago que el supervisor ya aprobó y están pendientes de ser pagados,
con toda la información necesaria para ejecutar cada pago.

**Why this priority**: Sin esta vista, el administrador no tiene visibilidad de cuánto debe
pagar a cada colaborador ni en qué estado está cada pago. Es el punto de entrada de la etapa
de pago efectivo, que cierra el ciclo laboral semanal.

**Independent Test**: Dado un conjunto de liquidaciones aprobadas en la semana W, el
administrador puede ver la lista completa con montos y proceder al pago de cada una.

**Acceptance Scenarios**:

1. **Given** existen liquidaciones en estado APROBADO para la semana activa,
   **When** el administrador accede a la vista de consolidados pendientes,
   **Then** el sistema muestra la lista completa de liquidaciones aprobadas y no pagadas, con:
   nombre del colaborador, período (fechas), monto total a pagar y estado del pago
   (Pendiente).

2. **Given** la vista de consolidados pendientes está abierta,
   **When** no hay liquidaciones aprobadas pendientes de pago,
   **Then** el sistema muestra un mensaje claro indicando que no hay consolidados pendientes.

3. **Given** existen liquidaciones de varias semanas distintas sin pagar,
   **When** el administrador accede a la vista,
   **Then** el sistema muestra todas las liquidaciones pendientes independientemente del período,
   con la semana visible en cada fila para contexto.

---

### User Story 2 - Revisión y Registro de Pago Individual (Priority: P2)

El administrador selecciona un consolidado de la lista, revisa el desglose completo
(horas, tarifa, bonos y descuentos) en una vista de detalle, y confirma el pago.
El sistema registra que el pago fue efectuado al colaborador.

**Why this priority**: La confirmación del pago cierra el ciclo del colaborador para esa
semana. Sin este registro, el sistema no distingue entre "aprobado para pagar" y "ya pagado".

**Independent Test**: Seleccionar una liquidación abre su detalle con el desglose completo.
Confirmar el pago cambia su estado a PAGADO y la elimina de la lista de pendientes.
La liquidación pagada no puede ser modificada.

**Acceptance Scenarios**:

1. **Given** una liquidación APROBADA visible en la lista de pendientes,
   **When** el administrador selecciona el consolidado,
   **Then** el sistema muestra la vista de detalle con el desglose completo: horas
   ordinarias y extra, tarifa aplicada (con indicador si fue ajustada por penalidad),
   bonos por día, descuentos del período y monto total a pagar.

2. **Given** el administrador está en la vista de detalle del consolidado,
   **When** confirma el pago,
   **Then** la liquidación pasa a estado PAGADO, desaparece de la lista de pendientes, y
   el sistema registra quién marcó el pago y en qué momento.

3. **Given** una liquidación recién marcada como PAGADA,
   **When** se intenta modificar su monto o reversar el pago,
   **Then** el sistema rechaza la operación; el pago registrado es inmutable.

---

### User Story 3 - Filtrado de Consolidados (Priority: P3)

El administrador filtra la lista de consolidados por período o busca un colaborador
específico para localizar rápidamente el pago que necesita procesar.

**Why this priority**: Con 50–200 colaboradores, encontrar el registro correcto sin
filtros requiere revisión manual lenta. Los filtros hacen la vista operativamente útil.

**Independent Test**: Filtrar por la semana actual muestra solo los consolidados de esa
semana. Buscar por nombre de colaborador muestra solo sus registros.

**Acceptance Scenarios**:

1. **Given** la lista de consolidados pendientes está abierta,
   **When** el administrador filtra por un período específico (semana),
   **Then** la lista muestra únicamente los consolidados de ese período.

2. **Given** la lista de consolidados pendientes está abierta,
   **When** el administrador escribe el nombre o cédula de un colaborador,
   **Then** la lista se reduce a los consolidados de ese colaborador.

---

### Edge Cases

- ¿Qué pasa si hay consolidados de varias semanas anteriores sin pagar acumulados? → Se muestran todos en la lista, ordenados por fecha de período (más antiguo primero) para priorizar los pagos atrasados.
- ¿Puede revertirse un pago marcado como PAGADO? → No en esta feature; el pago es inmutable. Una corrección posterior requiere una acción de ajuste explícita (feature futura).
- ¿Puede el administrador marcar todos los consolidados de una semana como pagados en lote? → No en esta feature; el pago se registra uno a uno. El pago en lote es una mejora futura.
- ¿Qué pasa si el administrador intenta acceder a la vista sin haber iniciado sesión? → El sistema redirige al login (cobertura de feature spec 005).
- ¿Qué pasa si una liquidación aprobada tiene monto total de $0? → Se muestra en la lista como cualquier otra; el administrador puede marcarla como pagada (pago en $0 es válido).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El ADMINISTRADOR tiene acceso completo a la vista de consolidados: puede ver todos los consolidados pendientes y marcarlos como pagados. El SUPERVISOR tiene acceso de solo lectura: puede ver el estado de pago (Pendiente / Pagado) de las liquidaciones de sus colaboradores asignados, pero no puede marcar pagos ni modificar nada.
- **FR-002**: El sistema DEBE mostrar la lista de todas las liquidaciones semanales en estado APROBADO que no han sido marcadas como PAGADAS, independientemente del período al que pertenezcan.
- **FR-003**: Cada fila de la lista DEBE mostrar: nombre completo del colaborador, cédula, período (fecha de inicio y fin de la semana), monto total a pagar y estado del pago (Pendiente).
- **FR-003B**: Al seleccionar un consolidado, el sistema DEBE mostrar una vista de detalle con el desglose completo: horas ordinarias, horas extra, tarifa aplicada (con indicador si fue ajustada por penalidad), bonos por día con tipo y monto, descuentos del período con motivo y monto total a pagar. La acción de confirmar el pago solo está disponible desde esta vista de detalle.
- **FR-004**: La lista DEBE ordenarse por defecto mostrando primero los períodos más antiguos, para priorizar el pago de deudas atrasadas.
- **FR-005**: El administrador DEBE poder filtrar la lista por período (semana) para ver solo los consolidados de una semana específica.
- **FR-006**: El administrador DEBE poder buscar por nombre o cédula del colaborador para localizar sus consolidados.
- **FR-007**: El administrador DEBE poder marcar una liquidación individual como PAGADA con una acción de confirmación explícita. El sistema registra quién realizó el pago y en qué momento.
- **FR-008**: Una liquidación en estado PAGADO es inmutable: no puede modificarse ni reversarse desde esta feature.
- **FR-009**: Al marcar como PAGADA, la liquidación desaparece de la lista de pendientes y pasa a ser consultable solo en el historial de pagos (fuera del alcance de esta feature).
- **FR-010**: Todo registro de pago DEBE quedar en el log de auditoría: usuario que marcó el pago, liquidación afectada, monto y timestamp.

### Key Entities

- **Consolidado de Pago**: Liquidación semanal aprobada que está pendiente de ser pagada al colaborador. Muestra el resumen de horas, tarifa, bonos y monto total del período.
- **Estado de Pago**: Ciclo de vida de la liquidación en su etapa final: APROBADO (pendiente de pago) → PAGADO (pago registrado). El estado PAGADO es irreversible.
- **Registro de Pago**: Traza inmutable de quién marcó una liquidación como pagada y en qué momento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede localizar y marcar como pagado el consolidado de un colaborador en menos de 1 minuto desde que abre la vista.
- **SC-002**: El 100% de las liquidaciones en estado APROBADO y no pagadas aparecen en la lista, sin omisiones.
- **SC-003**: El 100% de los pagos registrados quedan en el log de auditoría con usuario, timestamp y monto.
- **SC-004**: Tras marcar como PAGADO, el consolidado desaparece de la lista de pendientes en la misma sesión, sin necesidad de recargar la página.
- **SC-005**: El 100% de los intentos de modificar una liquidación PAGADA son rechazados.

## Assumptions

- En el MVP, la función de cajero es ejercida por el usuario con rol ADMINISTRADOR. No existe un rol "CAJERO" como entidad separada en el sistema; el brief usa ese término como descripción de la función, no como un rol técnico del sistema. Si en el futuro se requiere un rol diferenciado de cajero, implicará una enmienda al modelo de datos.
- El estado de pago PAGADO requiere una enmienda al modelo de datos (spec 003): añadir el valor `PAGADO` al enum `EstadoLiquidacion`. Actualmente el enum tiene `{ BORRADOR, APROBADO }`. La nueva secuencia sería `BORRADOR → APROBADO → PAGADO`. Esta enmienda debe tramitarse antes de la implementación.
- "Consolidado de pago" en el brief corresponde a la entidad `LiquidacionSemanal` del modelo aprobado (spec 003). No es una entidad separada.
- La vista de historial de pagos ya completados (estado PAGADO) está fuera del alcance de esta feature.
- El pago en lote (marcar toda una semana como pagada en un solo clic) está fuera del alcance de esta feature; es una mejora futura.
- El sistema no genera comprobantes de pago ni integra con sistemas de transferencia bancaria en esta feature; el registro es puramente un cambio de estado en el sistema.
- Esta feature depende de spec 006 (gestión de liquidación semanal) para que existan liquidaciones en estado APROBADO.
