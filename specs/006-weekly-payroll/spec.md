# Feature Specification: Gestión de Liquidación Semanal

**Feature Branch**: `006-weekly-payroll`

**Created**: 2026-05-22

**Status**: Draft

## Clarifications

### Session 2026-05-22

- Q: ¿Qué representa `total_descuentos` y quién lo determina en esta feature? → A: Los descuentos son deducciones adicionales que el supervisor aplica libremente (préstamos, anticipos, multas no relacionadas a asistencia). Requieren monto y motivo. Son independientes de las penalidades de horas y tarifa.
- Q: ¿Puede haber más de un bono del mismo tipo en el mismo día para el mismo colaborador? → A: No; solo un bono por tipo por día. Si ya existe, el sistema rechaza el duplicado con mensaje claro y sugiere editar el bono existente.
- Q: ¿Cuándo se crea la liquidación en estado BORRADOR? → A: Automáticamente cuando se procesa el primer marcaje biométrico del colaborador en esa semana. El supervisor siempre encuentra un borrador pre-existente al abrir la vista de revisión.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Revisión y Ajuste de Asistencias del Período (Priority: P1)

El supervisor o administrador selecciona un colaborador y una semana laboral, revisa sus
registros de asistencia con las horas calculadas automáticamente desde los marcajes biométricos,
identifica atrasos y aplica ajustes: penalidad de horas en días específicos o penalidad de
tarifa para todo el período.

**Why this priority**: Es el núcleo del proceso de liquidación. Sin poder revisar y ajustar
asistencias, no es posible generar liquidaciones confiables ni aplicar las políticas de pago
de la empresa.

**Independent Test**: Dado un colaborador con marcajes biométricos en una semana, el supervisor
puede ajustar las horas de un día con atraso y aplicar una tarifa reducida para el período.
El total calculado refleja los ajustes inmediatamente.

**Acceptance Scenarios**:

1. **Given** una semana laboral abierta con marcajes biométricos registrados para el colaborador C,
   **When** el supervisor selecciona a C para ese período,
   **Then** el sistema muestra la lista de días del período con: horas calculadas automáticamente
   desde los marcajes, indicador de atraso si el ingreso fue posterior al horario esperado, y
   el estado de cada día (sin ajuste / con penalidad de horas / con penalidad de tarifa).

2. **Given** el día Martes muestra atraso de 45 minutos para el colaborador C,
   **When** el supervisor aplica una penalidad de horas fijando las horas del día en 7 (en lugar
   de 8 calculadas automáticamente),
   **Then** el total de horas del período se recalcula inmediatamente restando la hora ajustada,
   y el día queda marcado como "con penalidad de horas".

3. **Given** el colaborador C no cumplió el mínimo de asistencia del período,
   **When** el supervisor aplica una penalidad de tarifa fijando la tarifa del período en 13 bs/h
   (en lugar de la tarifa vigente de 15 bs/h),
   **Then** el total de pago del período se recalcula usando la tarifa ajustada sobre todas las
   horas del período, y el motivo de la penalidad queda registrado.

4. **Given** un día con atraso,
   **When** el supervisor revisa la asistencia y decide no aplicar penalidad,
   **Then** puede marcar explícitamente "pago completo" y el día queda aprobado sin ajuste.

---

### User Story 2 - Asignación de Bonos por Día (Priority: P2)

El supervisor asigna bonos de transporte, alimentación o genérico a un colaborador para un
día específico dentro del período en revisión.

**Why this priority**: Los bonos son parte del pago total del colaborador. Su asignación
correcta es necesaria antes de aprobar la liquidación.

**Independent Test**: Asignar un bono de transporte para el día Lunes de una semana y
verificar que el monto aparece sumado al total de la liquidación del período.

**Acceptance Scenarios**:

1. **Given** el supervisor está revisando el período semanal del colaborador C,
   **When** selecciona el día Lunes y asigna un bono de transporte por el monto configurado,
   **Then** el bono queda registrado para ese día específico y el total del período se
   actualiza sumando el monto del bono.

2. **Given** un día en particular del período,
   **When** el supervisor asigna un bono genérico con monto y motivo libre,
   **Then** el bono queda registrado con su justificación y se suma al total del período.

3. **Given** ya existe un bono de transporte asignado para el día Lunes,
   **When** el supervisor intenta asignar un segundo bono de transporte para el mismo día,
   **Then** el sistema rechaza la operación con un mensaje claro indicando el duplicado, y
   sugiere editar el monto del bono de transporte ya existente para ese día.

---

### User Story 3 - Aprobación de la Liquidación Semanal (Priority: P3)

Tras revisar todas las asistencias y asignar los bonos del período, el supervisor o
administrador aprueba la liquidación semanal del colaborador, cerrando la posibilidad de
modificaciones posteriores.

**Why this priority**: La aprobación formaliza el compromiso de pago. Es la señal de que el
proceso de revisión está completo y los datos son confiables para el área contable.

**Independent Test**: Aprobar la liquidación del colaborador C para la semana W. Verificar
que la liquidación queda en estado APROBADO y ya no permite modificaciones de asistencias
ni bonos.

**Acceptance Scenarios**:

1. **Given** todas las asistencias del período han sido revisadas (con o sin ajustes),
   **When** el supervisor aprueba la liquidación,
   **Then** la liquidación queda en estado APROBADO con el total final calculado, la fecha de
   aprobación y el nombre del aprobador registrados.

2. **Given** una liquidación en estado APROBADO,
   **When** se intenta modificar horas, penalidades o bonos,
   **Then** el sistema rechaza la modificación indicando que la liquidación ya fue aprobada.

3. **Given** una liquidación aprobada para el colaborador C en la semana W,
   **When** el administrador consulta el resumen del período,
   **Then** visualiza: horas ordinarias, horas extra, tarifa aplicada (con indicador si fue
   ajustada), bonos asignados por día, total de descuentos y total a pagar.

---

### Edge Cases

- ¿Qué pasa si un día del período no tiene ningún marcaje biométrico? → El día aparece como ausente (0 horas). El supervisor puede dejarlo así (ausentismo no remunerado) o justificar con una nota.
- ¿Pueden coexistir penalidad de horas y penalidad de tarifa en el mismo período? → Sí; son independientes. El cálculo final es: horas_ajustadas × tarifa_ajustada + bonos.
- ¿Qué pasa si ya existe una tarifa específica para ese colaborador (no la global)? → La penalidad de tarifa del período reemplaza esa tarifa específica solo para la semana en cuestión.
- ¿Puede el supervisor modificar la liquidación después de aprobarla? → No; la liquidación aprobada es inmutable. Cualquier corrección posterior requiere una acción de ajuste explícita registrada en auditoría (feature futura).
- ¿Puede el mismo colaborador tener múltiples liquidaciones por el mismo período? → No; el modelo garantiza una única liquidación por colaborador por semana. El borrador se crea automáticamente con el primer marcaje; si ya existe, se continúa editando el mismo registro.
- ¿Qué pasa si la semana laboral está en estado CERRADA antes de aprobar todas las liquidaciones? → El cierre de semana y la aprobación de liquidaciones son acciones independientes; una semana puede cerrarse sin que todas las liquidaciones individuales estén aprobadas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo usuarios con rol ADMINISTRADOR o SUPERVISOR pueden gestionar liquidaciones. El SUPERVISOR solo puede gestionar los colaboradores asignados a su cargo.
- **FR-002**: El sistema DEBE mostrar para cada día del período seleccionado: fecha, horas calculadas automáticamente desde marcajes biométricos, hora de ingreso registrada, indicador de atraso (si el ingreso fue posterior al horario laboral configurado), y estado del día (sin revisión / aprobado / penalidad de horas / penalidad de tarifa).
- **FR-003**: El supervisor DEBE poder aplicar una penalidad de horas en un día específico, fijando manualmente el número de horas a contabilizar para ese día (valor ≥ 0). El sistema recalcula el total de horas del período al instante.
- **FR-004**: El supervisor DEBE poder aplicar una penalidad de tarifa para el período completo, fijando la tarifa horaria efectiva del período (valor > 0). Esta tarifa reemplaza la tarifa vigente del colaborador para ese período específico. Se registra el motivo de la penalidad.
- **FR-005**: El supervisor DEBE poder marcar una asistencia como "pago completo" (sin penalidad), incluso si el sistema detectó un atraso, registrando esta decisión explícita.
- **FR-006**: El sistema DEBE mostrar una advertencia cuando el colaborador no alcanza el umbral mínimo de asistencia configurado para el período. La advertencia es informativa; la decisión de aplicar penalidad es del supervisor.
- **FR-007**: El supervisor DEBE poder asignar bonos al colaborador para días específicos dentro del período: transporte, alimentación o genérico. Cada bono requiere tipo, monto y, para bonos genéricos, una justificación. Solo puede existir un bono por tipo por día; intentar crear un duplicado produce un error con sugerencia de editar el existente.
- **FR-007B**: El supervisor DEBE poder registrar descuentos adicionales para el período: préstamos, anticipos, multas u otras deducciones no relacionadas a asistencia. Cada descuento requiere monto y motivo. Pueden aplicarse múltiples descuentos por período.
- **FR-008**: El sistema DEBE calcular y mostrar en tiempo real el total de la liquidación: (horas_ordinarias × tarifa) + (horas_extra × tarifa_extra) + total_bonos − total_descuentos, actualizándose con cada ajuste de horas, tarifa, bono o descuento.
- **FR-009**: El supervisor o administrador DEBE poder aprobar la liquidación del período para un colaborador. Una liquidación aprobada no puede ser modificada.
- **FR-010**: El sistema DEBE crear automáticamente una liquidación en estado BORRADOR para el colaborador al procesar su primer marcaje biométrico de la semana. Si ya existe una liquidación para ese colaborador y período (en cualquier estado), no se crea una nueva.
- **FR-011**: Toda acción de ajuste (penalidad de horas, penalidad de tarifa, asignación de bono, aprobación) DEBE quedar registrada en el log de auditoría con el usuario que realizó la acción, timestamp y valores anteriores/nuevos.

### Key Entities

- **Período Semanal**: Semana laboral de sábado a viernes. Es la unidad de liquidación. Solo puede estar abierta o cerrada.
- **Registro de Asistencia Diaria**: Conjunto de marcajes biométricos de un día para un colaborador, del cual se calculan las horas trabajadas y se detectan atrasos.
- **Ajuste de Horas**: Número de horas que el supervisor fija manualmente para un día específico, reemplazando el valor calculado automáticamente desde biométricos.
- **Penalidad de Tarifa del Período**: Tarifa horaria reducida que el supervisor aplica a TODAS las horas del período para el colaborador, por no cumplir el objetivo de asistencia u otro motivo justificado.
- **Bono del Período**: Pago adicional (transporte, alimentación o genérico) asignado por el supervisor para un día específico dentro del período.
- **Descuento del Período**: Deducción adicional aplicada por el supervisor al total del período. Puede representar un préstamo, anticipo, multa u otra retención. Requiere monto y motivo justificado.
- **Liquidación Semanal**: Resumen final del pago del período: horas contabilizadas, tarifa aplicada, bonos, descuentos y total a pagar. Pasa de BORRADOR a APROBADO.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El supervisor puede revisar y ajustar todas las asistencias de un colaborador para una semana y aprobar la liquidación en menos de 5 minutos.
- **SC-002**: El total calculado de la liquidación se actualiza en menos de 2 segundos tras cada ajuste de horas, tarifa o bono.
- **SC-003**: El 100% de los ajustes manuales (penalidades, bonos, aprobaciones) quedan registrados en el log de auditoría.
- **SC-004**: El 100% de las liquidaciones aprobadas son inmutables; ningún ajuste posterior es posible sin una acción de corrección explícita.
- **SC-005**: El sistema detecta y muestra correctamente el 100% de los días con atraso basándose en el horario laboral configurado del colaborador.

## Assumptions

- El período semanal va de sábado a viernes; este ciclo está configurado en la entidad `SemanaLaboral` del modelo de datos aprobado (spec 003).
- Las horas por día se calculan automáticamente a partir de los registros de `EventoBiometricoDesglosado` (checktime de entrada y salida). Esta feature no incluye la lógica de cálculo de horas desde biométricos; esa lógica es responsabilidad del módulo de procesamiento de eventos (feature posterior o parte del procesamiento de spec 001).
- La detección de atrasos requiere que el colaborador tenga un horario laboral configurado (feature spec 004). Si no tiene horario, no se puede detectar atraso automáticamente.
- La penalidad de tarifa reemplaza la tarifa del período del colaborador. Si el colaborador no tenía tarifa específica, reemplaza la tarifa global para ese período.
- La penalidad de horas y la penalidad de tarifa son independientes y pueden combinarse en el mismo período: `total_pago = horas_ajustadas × tarifa_ajustada + bonos`.
- El tipo de bono "genérico" requiere una enmienda al modelo de datos (spec 003), añadiendo el valor `GENERICO` al enum `TipoBono`. Esta enmienda debe tramitarse antes de la implementación.
- La asignación de bonos por día específico requiere verificar si la entidad `Bono` del modelo actual necesita un campo `fecha_dia`. Esta enmienda debe evaluarse en la fase de planificación.
- La liquidación en estado BORRADOR se crea automáticamente cuando el sistema procesa el primer marcaje biométrico del colaborador en esa semana. El supervisor siempre encuentra un borrador pre-existente; no necesita un paso de "crear liquidación".
- Esta feature no incluye el cierre de la semana laboral (acción sobre `SemanaLaboral`); solo gestiona liquidaciones individuales por colaborador.
- Esta feature no incluye la corrección de liquidaciones ya aprobadas; ese caso es una feature futura de ajuste explícito.
- Las horas extra se calculan según el umbral configurado en `ConfiguracionRegla` (tipo `UMBRAL_HORA_EXTRA`) del colaborador o global.
