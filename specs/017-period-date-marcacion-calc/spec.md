# Feature Specification: Payroll Period Date Suggestion & Marcación Live Calculation

**Feature Branch**: `017-period-date-marcacion-calc`

**Created**: 2026-06-03

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fecha fin sugerida y editable al crear período de pago (Priority: P1)

Al crear un nuevo período de pago, el supervisor selecciona el tipo de período (Semanal, Quincenal o Mensual) y la fecha de inicio. El sistema calcula y sugiere automáticamente la fecha de fin correspondiente. El supervisor puede aceptar la sugerencia o modificarla manualmente antes de confirmar.

**Why this priority**: Reduce errores en la creación de períodos — actualmente la fecha fin se calcula automáticamente sin posibilidad de ajuste, lo que impide casos como semanas cortas o períodos ajustados por feriados.

**Independent Test**: Crear un período SEMANAL con fecha inicio 2026-06-01; el sistema sugiere 2026-06-07; editar a 2026-06-05 y guardar exitosamente.

**Acceptance Scenarios**:

1. **Given** el diálogo de nuevo período abierto, **When** el supervisor selecciona tipo "Semanal" y fecha inicio "2026-06-01", **Then** la fecha fin se pre-completa con "2026-06-07" de forma automática.
2. **Given** la fecha fin sugerida visible, **When** el supervisor la edita manualmente a "2026-06-05", **Then** la nueva fecha es aceptada y el período se crea con esa fecha.
3. **Given** tipo "Quincenal" y fecha inicio "2026-06-01", **When** el campo se completa, **Then** la fecha fin sugerida es "2026-06-15".
4. **Given** tipo "Mensual" y fecha inicio "2026-06-01", **When** el campo se completa, **Then** la fecha fin sugerida es "2026-06-30" (último día del mes).
5. **Given** fecha fin editada manualmente, **When** la fecha fin es anterior a la fecha inicio, **Then** el sistema muestra error y bloquea el guardado.

---

### User Story 2 — Sumatoria de horas actualizada en tiempo real al editar marcaciones (Priority: P1)

Al editar los campos de entrada o salida de una marcación, el total de horas calculado para esa jornada se actualiza inmediatamente en pantalla. El campo queda en estado "pendiente de guardar" hasta que el usuario confirme la persistencia.

**Why this priority**: El supervisor necesita ver el impacto de sus cambios antes de confirmar — actualmente el total solo se actualiza después de guardar, lo que genera incertidumbre y errores.

**Independent Test**: Editar la hora de salida de una jornada de 08:00–12:00 a 08:00–13:00; el subtotal de esa jornada pasa de "4.0h" a "5.0h" sin necesidad de guardar.

**Acceptance Scenarios**:

1. **Given** una jornada con entrada 08:00 y salida 12:00 mostrando "4.0h", **When** el supervisor cambia la salida a 13:00, **Then** el subtotal se actualiza inmediatamente a "5.0h".
2. **Given** múltiples jornadas en un día, **When** se edita cualquier campo de hora, **Then** el total del día se recalcula en tiempo real sumando todas las jornadas.
3. **Given** un campo de hora editado pero no guardado, **When** el supervisor visualiza el total, **Then** el total refleja el valor pendiente con indicación visual de "sin guardar".
4. **Given** una salida en blanco (jornada incompleta), **When** se computa el total, **Then** esa jornada contribuye 0 horas al total y no genera error.
5. **Given** cambios en el editor de marcaciones, **When** el supervisor descarta los cambios, **Then** el total vuelve al valor guardado original.

---

### Edge Cases

- ¿Qué sucede si la fecha de inicio del período es el último día del mes y el tipo es Mensual? → La fecha fin sugerida debe ser el mismo día (período de 1 día), editable.
- ¿Qué pasa si se cambia el tipo de período después de haber editado la fecha fin manualmente? → La fecha fin se recalcula con la nueva sugerencia, pisando el valor manual.
- ¿Qué ocurre si entrada y salida son iguales (0 horas)? → El subtotal muestra 0.0h sin error.
- ¿Qué pasa si la salida es menor a la entrada (ej. turno nocturno)? → El sistema muestra 0h para esa jornada (no se calculan horas negativas).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE calcular y pre-completar la fecha fin al seleccionar tipo de período y fecha inicio, sin requerir acción adicional del usuario.
- **FR-002**: La fecha fin sugerida DEBE ser editable por el usuario antes de confirmar la creación del período.
- **FR-003**: El sistema DEBE recalcular la fecha fin sugerida si el usuario cambia el tipo de período, incluso si ya había modificado la fecha fin manualmente.
- **FR-004**: El sistema DEBE validar que la fecha fin no sea anterior a la fecha inicio al intentar guardar, mostrando mensaje de error claro.
- **FR-005**: El subtotal de horas de cada jornada DEBE actualizarse en tiempo real al modificar cualquier campo de hora (entrada o salida).
- **FR-006**: El total de horas del día DEBE recalcularse en tiempo real sumando todos los subtotales de las jornadas del día.
- **FR-007**: El editor de marcaciones DEBE mostrar indicación visual que distingue el estado "con cambios pendientes" del estado "guardado".
- **FR-008**: Al descartar cambios, los totales DEBEN volver al último valor guardado.
- **FR-009**: Las jornadas con salida en blanco DEBEN contribuir 0 horas al total sin bloquear el cálculo de otras jornadas.

### Key Entities

- **Período de pago**: tipo (Semanal/Quincenal/Mensual), fecha inicio, fecha fin editable, creado por.
- **Jornada**: hora entrada, hora salida, horas calculadas (subtotal en tiempo real).
- **Día de marcación**: conjunto de jornadas, total de horas (suma en tiempo real).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El supervisor puede crear un período con fecha fin ajustada en menos de 30 segundos desde abrir el diálogo.
- **SC-002**: El subtotal de horas de una jornada se actualiza en menos de 100ms tras modificar cualquier campo de hora.
- **SC-003**: 0 errores de fecha inválida llegan al servidor — la validación en pantalla bloquea el envío.
- **SC-004**: El supervisor puede ver el impacto de un cambio de marcación antes de guardarlo en el 100% de los casos.

## Assumptions

- El cálculo de fecha fin para períodos Semanales es: inicio + 6 días (7 días totales).
- El cálculo para Quincenales es: inicio + 14 días (15 días totales).
- El cálculo para Mensuales es: último día del mes calendario de la fecha inicio.
- Los turnos nocturnos (salida < entrada) no están en scope — se tratan como 0 horas.
- La indicación visual de "pendiente de guardar" es el comportamiento ya existente en el editor (ícono de guardar habilitado); no se requiere un nuevo indicador adicional.
- Esta especificación describe mejoras a la UI existente, no cambios en la estructura de datos del backend.
