# Feature Specification: Configuración de Reglas de Nómina y Horarios

**Feature Branch**: `008-configure-payroll-rules`

**Created**: 2026-05-22

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar Tarifa Horaria por Colaborador (Priority: P1)

El administrador accede al perfil de un colaborador y asigna o actualiza su tarifa horaria
(Bs./h). Este valor es el único parámetro de cálculo requerido: el sistema lo usa para
calcular `horas_trabajadas × tarifa_hora = total_pago` en cada liquidación semanal.
No existen reglas agrupadas, umbrales de hora extra, multiplicadores ni montos de referencia
para bonos — solo el valor de tarifa que persiste en el perfil del colaborador.

**Why this priority**: Sin tarifa configurada, el sistema no puede calcular el total de pago
de la liquidación. Es el prerequisito directo del cálculo de liquidaciones (feature 006).

**Independent Test**: El administrador abre el perfil del colaborador "Juan Pérez" y
establece su tarifa en 15 Bs./h. Al procesar la liquidación de la semana siguiente con
40 horas trabajadas, el total calculado es 600 Bs. Al cambiar la tarifa a 18 Bs./h, los
nuevos cálculos usan 18; las liquidaciones ya aprobadas no se ven afectadas.

**Acceptance Scenarios**:

1. **Given** el administrador accede al perfil de un colaborador,
   **When** ingresa o modifica la tarifa horaria (valor > 0),
   **Then** el valor queda guardado y es el que el sistema usa para calcular la próxima
   liquidación de ese colaborador.

2. **Given** un colaborador tiene tarifa configurada,
   **When** el administrador la actualiza,
   **Then** el cambio aplica a liquidaciones futuras (no aprobadas). Las liquidaciones
   ya en estado APROBADO no se recalculan. El log de auditoría registra el valor anterior,
   el nuevo valor, el usuario que realizó el cambio y el timestamp.

3. **Given** el administrador intenta guardar una tarifa con valor ≤ 0,
   **When** intenta confirmar,
   **Then** el sistema rechaza la operación con un mensaje indicando que la tarifa debe
   ser mayor a cero. El valor no se guarda.

4. **Given** el administrador consulta la lista de colaboradores,
   **When** visualiza el listado,
   **Then** cada colaborador muestra su tarifa horaria vigente y si aún no tiene tarifa
   asignada, aparece con un indicador de "Sin tarifa" que alerta sobre la configuración
   incompleta.

---

### User Story 2 - Configurar Plantilla de Horario (Priority: P1)

El administrador crea una plantilla de horario que define los días laborables de la semana
y la hora de entrada esperada. La plantilla es la referencia para detectar atrasos
automáticamente durante la revisión de liquidación.

**Why this priority**: Sin una plantilla de horario asignada, el sistema no puede detectar
atrasos automáticamente ni mostrar el indicador de atraso al supervisor durante la revisión
de liquidación (spec 006). Es un prerequisito directo para esa feature.

**Independent Test**: El administrador crea la plantilla "Turno Mañana" con días laborables
lunes a viernes y hora de entrada 7:00. Un colaborador asignado a esa plantilla con
ingreso a las 7:32 aparece con atraso en la revisión de su liquidación.

**Acceptance Scenarios**:

1. **Given** el administrador accede a la gestión de plantillas de horario,
   **When** crea una nueva plantilla con nombre, días laborables seleccionados y hora de
   entrada esperada,
   **Then** la plantilla queda disponible para asignarse a colaboradores.

2. **Given** una plantilla de horario configurada con entrada a las 7:00,
   **When** un colaborador asignado a esa plantilla registra un ingreso a las 7:32,
   **Then** el sistema marca ese día como atraso; el supervisor ve el indicador al revisar
   la liquidación del colaborador.

3. **Given** el administrador intenta guardar una plantilla sin seleccionar ningún día
   laborable, o con una hora de entrada inválida,
   **When** intenta confirmar,
   **Then** el sistema rechaza la operación indicando el problema de validación.

---

### Edge Cases

- ¿Qué pasa si se actualiza la tarifa de un colaborador con liquidaciones ya aprobadas? → El cambio aplica solo a liquidaciones futuras (no aprobadas). Las liquidaciones en estado APROBADO no se recalculan.
- ¿Puede un colaborador no tener tarifa configurada? → Sí temporalmente, pero el sistema muestra un indicador de "Sin tarifa" en el listado. El cálculo de liquidación no puede ejecutarse sin tarifa.
- ¿Puede eliminarse una plantilla de horario que ya está asignada a un colaborador? → No; el sistema rechaza la eliminación e indica a qué colaboradores está asignada. El administrador debe reasignar antes de eliminar.
- ¿Puede un colaborador no tener plantilla de horario asignada? → Sí; en ese caso el sistema no detecta atrasos para ese colaborador. No es un error bloqueante para la liquidación.
- ¿Los turnos que cruzan la medianoche están soportados? → No; solo se soportan turnos dentro del mismo día calendario.

## Requirements *(mandatory)*

### Functional Requirements

**Tarifa Horaria**

- **FR-001**: Solo el ADMINISTRADOR puede configurar la tarifa horaria y las plantillas de horario. El SUPERVISOR no tiene acceso a estas configuraciones.
- **FR-002**: El sistema DEBE permitir asignar una `tarifa_hora` (valor > 0, en Bs./h) a cada colaborador. Este es el único parámetro de cálculo requerido. No existen umbrales de hora extra ni multiplicadores.
- **FR-003**: ~~Montos de referencia de bonos~~ — **fuera de alcance**. Los bonos se gestionan manualmente en la liquidación; no hay valores de referencia configurables en esta feature.
- **FR-004**: La tarifa_hora asignada a un colaborador puede modificarse directamente. El historial de cambios queda registrado en el log de auditoría (quién cambió, cuándo, valor anterior y nuevo).
- **FR-005**: El sistema DEBE mostrar la tarifa_hora vigente de cada colaborador, con la fecha del último cambio y el usuario que lo realizó.

**Plantilla de Horario**

- **FR-006**: El sistema DEBE permitir crear una plantilla de horario con: nombre descriptivo único, días laborables de la semana (selección múltiple de lunes a domingo; mínimo uno) y hora de entrada esperada (para detección de atraso). La hora de salida y el indicador de horario extremo quedan fuera de scope.
- **FR-007**: ~~Validación hora entrada/salida~~ — **simplificado**. Solo se valida que la hora de entrada sea un valor válido (HH:MM entre 00:00 y 23:59). Los turnos que cruzan la medianoche siguen fuera del alcance.
- **FR-008**: Una plantilla asignada a al menos un colaborador activo no puede eliminarse. El sistema muestra a quién está asignada antes de rechazar la eliminación.
- **FR-009**: El sistema DEBE mostrar la lista de plantillas con: nombre, días laborables, hora de entrada esperada y estado de uso (asignada / sin asignar).

- **FR-010**: Toda modificación de tarifa horaria o creación/modificación de plantilla DEBE quedar registrada en el log de auditoría con el usuario que realizó la acción, el timestamp, y los valores anterior y nuevo.

### Key Entities

- **Tarifa Horaria**: Valor numérico en Bs./h asignado directamente al perfil de cada colaborador. Es el único parámetro de cálculo requerido; se puede modificar en cualquier momento. El historial de cambios queda en el log de auditoría.
- **Plantilla de Horario**: Define el nombre, los días laborables de la semana y la hora de entrada esperada para un turno. Se asigna directamente al perfil del colaborador y sirve para detectar atrasos automáticamente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede establecer o actualizar la tarifa horaria de un colaborador en menos de 30 segundos desde que accede al perfil.
- **SC-002**: El administrador puede crear una plantilla de horario completa en menos de 1 minuto.
- **SC-003**: El 100% de las modificaciones de tarifa y creaciones/modificaciones de plantillas quedan en el log de auditoría con usuario, timestamp y valores anterior/nuevo.
- **SC-004**: El sistema rechaza el 100% de los intentos de guardar una tarifa ≤ 0 con un mensaje de validación claro.
- **SC-005**: El listado de colaboradores muestra la tarifa vigente de cada uno; los colaboradores sin tarifa se identifican con un indicador visible.

## Clarifications

### Session 2026-06-01

- Q: ¿Cuando el supervisor revisa una liquidación, el total de pago se calcula automáticamente o se ingresa manualmente? → A: El sistema calcula `horas × tarifa_hora` automáticamente; el administrador solo necesita configurar la tarifa. Lo que desaparece son los templates de reglas con vigencia/effective dating, los montos de referencia de bonos y los cálculos sugeridos — no el cálculo básico de horas × tarifa.
- Q: ¿El concepto de hora extra (overtime) sigue existiendo? → A: No — todas las horas se pagan al mismo valor de tarifa_hora; no hay distinción entre horas ordinarias y extra, ni umbral ni multiplicador. El ajuste manual (ajuste_tipo en la liquidación) cubre casos especiales.
- Q: ¿La plantilla de horario (US2) sigue en scope y en qué forma? → A: Sí, pero simplificada — nombre + días laborables + hora de entrada esperada (para detección de atraso). Se eliminan el criterio de hora de salida y el indicador de "turno extremo".
- Q: ¿Cómo se asigna la tarifa_hora y la plantilla de horario a los colaboradores? → A: Directamente en el perfil de cada colaborador — el admin edita los valores individualmente por persona. No existe asignación por departamento ni herencia. US3 (Asignación de Departamento) queda fuera de scope.

## Assumptions

- La función de configurar tarifa horaria y plantillas de horario es exclusiva del rol ADMINISTRADOR. El SUPERVISOR no tiene acceso a estas configuraciones.
- La tarifa horaria y la plantilla de horario se configuran directamente en el perfil de cada colaborador. No existe asignación por departamento ni herencia de configuración.
- Los bonos se gestionan manualmente en la liquidación; no hay valores de referencia configurables en esta feature.
- Los turnos que cruzan la medianoche están fuera del alcance de esta feature. Solo se soportan turnos dentro del mismo día calendario.
- Esta feature depende de spec 004 (registro de colaboradores) para que existan colaboradores a los que asignar tarifa y plantilla.
- El modelo de datos requiere agregar `tarifa_hora` y `plantilla_horario_id` al perfil del colaborador (`colaboradores`). Esta enmienda se tramita en la fase de planificación.
