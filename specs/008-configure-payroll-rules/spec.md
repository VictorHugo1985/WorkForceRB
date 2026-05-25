# Feature Specification: Configuración de Reglas de Nómina y Horarios

**Feature Branch**: `008-configure-payroll-rules`

**Created**: 2026-05-22

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar Regla de Nómina (Priority: P1)

El administrador crea una regla de nómina que agrupa los parámetros de cálculo de pago:
tarifa horaria ordinaria, umbral de horas diarias para activar la hora extra, multiplicador
de hora extra y montos de referencia para bonos estándar. Cada regla tiene fecha de inicio
de vigencia para que las modificaciones futuras no alteren períodos ya calculados.

**Why this priority**: La regla de nómina es el núcleo de todos los cálculos de pago.
Sin parámetros configurados, el sistema no puede calcular liquidaciones. Es el prerequisito
de todas las operaciones de spec 006 y spec 007.

**Independent Test**: El administrador crea la regla "Tarifa Estándar 2026" con tarifa de
15 bs/h, umbral de 8 h/día, multiplicador 1.5× y vigencia desde 2026-01-01. Verifica que
la regla aparece en el listado como vigente y puede asignarse a un departamento.

**Acceptance Scenarios**:

1. **Given** el administrador accede a la gestión de reglas de nómina,
   **When** crea una nueva regla con nombre, tarifa ordinaria, umbral de hora extra,
   multiplicador y fecha de inicio de vigencia,
   **Then** la regla queda registrada como vigente desde esa fecha y disponible para
   asignarse a departamentos o colaboradores.

2. **Given** existe una regla de nómina activa,
   **When** el administrador crea una nueva regla con fecha de vigencia desde la fecha X,
   **Then** la regla anterior queda marcada como histórica hasta X y la nueva aplica desde
   X en adelante. Los períodos ya calculados con la regla anterior no se ven afectados.

3. **Given** el administrador configura una regla de nómina,
   **When** define los montos de referencia de bonos estándar (transporte, alimentación) e
   indica si cada tipo de bono está habilitado por defecto,
   **Then** esos valores quedan vinculados a la regla y son el valor de referencia que el
   supervisor ve al asignar bonos durante la revisión de liquidación.

4. **Given** el administrador intenta guardar una regla con tarifa ≤ 0, umbral ≤ 0 o
   multiplicador ≤ 1,
   **When** intenta confirmar,
   **Then** el sistema rechaza la operación con un mensaje que identifica el campo inválido.
   La regla no se guarda.

---

### User Story 2 - Configurar Plantilla de Horario (Priority: P1)

El administrador crea una plantilla de horario que define los días laborables de la semana
y la hora de entrada y salida esperada. La plantilla es la referencia para detectar atrasos
y clasificar si el turno es de horario extremo.

**Why this priority**: Sin una plantilla de horario asignada, el sistema no puede detectar
atrasos automáticamente ni mostrar el indicador de atraso al supervisor durante la revisión
de liquidación (spec 006). Es un prerequisito directo para esa feature.

**Independent Test**: El administrador crea la plantilla "Turno Mañana" con días laborables
lunes a viernes, entrada 7:00 y salida 16:00. Un colaborador asignado a esa plantilla con
ingreso a las 7:32 aparece con atraso en la revisión de su liquidación.

**Acceptance Scenarios**:

1. **Given** el administrador accede a la gestión de plantillas de horario,
   **When** crea una nueva plantilla con nombre, días laborables seleccionados, hora de
   entrada esperada y hora de salida esperada,
   **Then** la plantilla queda disponible para asignarse a departamentos o colaboradores.

2. **Given** una plantilla de horario configurada con entrada a las 7:00,
   **When** un colaborador asignado a esa plantilla registra un ingreso a las 7:32,
   **Then** el sistema marca ese día como atraso; el supervisor ve el indicador al revisar
   la liquidación del colaborador.

3. **Given** el administrador crea una plantilla y activa la opción de horario extremo,
   **When** guarda la plantilla,
   **Then** la plantilla queda clasificada como turno extremo; este indicador está disponible
   para que reglas futuras distingan entre turnos estándar y extremos.

4. **Given** el administrador intenta guardar una plantilla sin seleccionar ningún día
   laborable, o con hora de entrada igual a hora de salida,
   **When** intenta confirmar,
   **Then** el sistema rechaza la operación indicando el problema de validación.

---

### User Story 3 - Asignar Regla y Horario a Departamento o Colaborador (Priority: P1)

El administrador asigna una regla de nómina y una plantilla de horario a un departamento
completo. Todos los colaboradores del departamento heredan esa configuración
automáticamente. Opcionalmente puede asignar una configuración distinta a un colaborador
individual que tenga condiciones especiales.

**Why this priority**: La asignación es el puente entre la configuración y los colaboradores.
Sin ella, ninguna regla ni plantilla tiene efecto en el cálculo de liquidaciones.

**Independent Test**: El administrador asigna la regla "Tarifa Estándar" y la plantilla
"Turno Mañana" al departamento ACABADO. Todos los colaboradores de ACABADO sin override
individual heredan esa configuración automáticamente.

**Acceptance Scenarios**:

1. **Given** existen reglas de nómina y plantillas de horario creadas,
   **When** el administrador asigna una regla y una plantilla a un departamento,
   **Then** todos los colaboradores del departamento que no tienen override individual
   quedan vinculados a esa regla y plantilla para sus liquidaciones.

2. **Given** un departamento tiene la regla R1 y plantilla P1,
   **When** el administrador asigna al colaborador C (miembro de ese departamento) la regla
   R2 y plantilla P2 como override individual,
   **Then** el colaborador C utiliza R2 y P2 en sus liquidaciones; los demás colaboradores
   del departamento siguen usando R1 y P1.

3. **Given** un colaborador tiene override individual activo,
   **When** el administrador elimina el override del colaborador,
   **Then** el colaborador vuelve a heredar la regla y plantilla de su departamento.

4. **Given** el administrador consulta la lista de colaboradores de un departamento,
   **When** visualiza la configuración efectiva de cada colaborador,
   **Then** el sistema muestra para cada uno qué regla y plantilla aplican y si provienen
   del departamento (herencia) o de un override individual.

5. **Given** el administrador intenta guardar la asignación de un departamento sin
   seleccionar una regla de nómina o sin seleccionar una plantilla de horario,
   **When** intenta confirmar,
   **Then** el sistema rechaza la operación; ambos campos son obligatorios para
   la asignación de departamento.

---

### Edge Cases

- ¿Qué pasa si se intenta modificar una regla ya usada en períodos calculados? → No es posible; las reglas son inmutables una vez creadas. Para cambiar parámetros se crea una nueva regla con fecha de vigencia futura.
- ¿Puede un departamento no tener regla ni plantilla asignada? → Sí temporalmente, pero el sistema muestra una advertencia al intentar calcular liquidaciones para colaboradores de ese departamento sin configuración completa.
- ¿Qué pasa si un colaborador no tiene override y su departamento tampoco tiene asignación? → El sistema no puede calcular la liquidación; advierte al supervisor con un mensaje específico indicando que falta configuración.
- ¿Puede la misma regla asignarse a múltiples departamentos simultáneamente? → Sí; una regla puede estar asignada a cualquier número de departamentos y colaboradores al mismo tiempo.
- ¿Puede eliminarse una plantilla de horario que ya está asignada? → No; el sistema rechaza la eliminación y muestra a qué departamentos/colaboradores está asignada. El administrador debe reasignar antes.
- ¿Puede un override individual tener solo regla (sin plantilla) o solo plantilla (sin regla)? → Sí; el override es parcial. Si solo se anula la regla, el colaborador usa la regla del override más la plantilla del departamento, y viceversa.

## Requirements *(mandatory)*

### Functional Requirements

**Regla de Nómina**

- **FR-001**: Solo el ADMINISTRADOR puede crear y consultar reglas de nómina. El SUPERVISOR no tiene acceso a la configuración de reglas.
- **FR-002**: El sistema DEBE permitir crear una regla de nómina con los campos obligatorios: nombre descriptivo único, tarifa horaria ordinaria (valor > 0), umbral de horas diarias para activar hora extra (valor > 0), multiplicador de hora extra (valor > 1) y fecha de inicio de vigencia.
- **FR-003**: El sistema DEBE permitir configurar en la regla los montos de referencia para bonos estándar: monto de bono de transporte y monto de bono de alimentación, con un indicador de si cada tipo de bono está habilitado por defecto. Ambos montos pueden ser cero (bono no aplica).
- **FR-004**: Una regla de nómina no puede modificarse una vez creada. Para cambiar sus parámetros, el administrador debe crear una nueva regla. El sistema cierra automáticamente la vigencia de la regla anterior (vigente_hasta) al confirmar la nueva.
- **FR-005**: El sistema DEBE mostrar la lista de reglas de nómina con: nombre, tarifa ordinaria, umbral, multiplicador, período de vigencia y estado (vigente / histórica).

**Plantilla de Horario**

- **FR-006**: El sistema DEBE permitir crear una plantilla de horario con: nombre descriptivo único, días laborables de la semana (selección múltiple de lunes a domingo; mínimo uno), hora de entrada esperada, hora de salida esperada e indicador de horario extremo (sí/no).
- **FR-007**: El sistema DEBE validar que la hora de entrada y la hora de salida sean distintas. Los turnos que cruzan la medianoche están fuera del alcance de esta feature.
- **FR-008**: Una plantilla asignada a al menos un departamento o colaborador activo no puede eliminarse. El sistema muestra a quién está asignada antes de rechazar la eliminación.
- **FR-009**: El sistema DEBE mostrar la lista de plantillas con: nombre, días laborables, horario, indicador de turno extremo y estado de uso (asignada / sin asignar).

**Asignación**

- **FR-010**: El administrador DEBE poder asignar una regla de nómina y una plantilla de horario a un departamento. Ambos campos son obligatorios para la asignación de departamento.
- **FR-011**: El administrador DEBE poder asignar un override de regla y/o plantilla a un colaborador individual, sobrescribiendo parcial o totalmente la configuración de su departamento.
- **FR-012**: El administrador DEBE poder eliminar el override individual de un colaborador, restaurando la herencia completa del departamento.
- **FR-013**: El sistema DEBE mostrar para cada colaborador la configuración efectiva resultante (regla y plantilla que se aplicarán), con un indicador claro de si proviene del departamento (herencia) o de un override individual.
- **FR-014**: Toda creación de regla, plantilla o asignación DEBE quedar registrada en el log de auditoría con el usuario que realizó la acción y el timestamp.

### Key Entities

- **Regla de Nómina**: Agrupación nombrada de parámetros de cálculo: tarifa ordinaria, umbral de hora extra, multiplicador y montos de referencia de bonos estándar. Es inmutable una vez creada; los cambios se implementan como una nueva versión con nueva fecha de vigencia.
- **Plantilla de Horario**: Define los días laborables de la semana y la hora de entrada y salida esperada para un turno. Clasifica el turno como estándar o extremo.
- **Asignación de Departamento**: Vincula una regla de nómina y una plantilla de horario activas a un departamento. Todos los colaboradores del departamento la heredan salvo que tengan override individual.
- **Override Individual**: Asignación explícita (total o parcial) de regla y/o plantilla a un colaborador específico, que prevalece sobre la configuración del departamento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede crear una regla de nómina completa con todos sus parámetros en menos de 2 minutos.
- **SC-002**: El administrador puede crear una plantilla de horario completa en menos de 1 minuto.
- **SC-003**: El administrador puede asignar regla y plantilla a un departamento en menos de 1 minuto.
- **SC-004**: El 100% de los colaboradores de un departamento asignado refleja la nueva configuración en el mismo instante en que se guarda la asignación, sin pasos adicionales.
- **SC-005**: El 100% de las creaciones de reglas, plantillas y asignaciones quedan en el log de auditoría con usuario y timestamp.
- **SC-006**: El sistema rechaza el 100% de los intentos de guardar una regla con tarifa ≤ 0, umbral ≤ 0 o multiplicador ≤ 1.

## Assumptions

- La función de configurar reglas y horarios es exclusiva del rol ADMINISTRADOR. El SUPERVISOR no tiene acceso a estas configuraciones.
- Una "regla de nómina" en el contexto de esta feature agrupa múltiples parámetros que en el modelo de datos (spec 003) pueden estar representados como entradas de `ConfiguracionRegla` con effective dating (vigente_desde / vigente_hasta). El mapeo exacto campo a campo se define en la fase de planificación.
- Los montos de referencia de bonos estándar en la regla de nómina son valores de referencia, no máximos ni obligatorios. El supervisor puede ingresar montos distintos al asignar un bono durante la revisión de liquidación (spec 006).
- "Horario extremo" es un indicador booleano en la plantilla para uso informativo y futuras reglas diferenciadas. La lógica de pago diferenciado para turnos extremos está fuera del alcance de esta feature.
- Los turnos que cruzan la medianoche (hora de salida menor a hora de entrada) están fuera del alcance de esta feature. Solo se soportan turnos dentro del mismo día calendario.
- Esta feature asume que los departamentos (áreas de trabajo) ya existen en el sistema. La creación de departamentos es responsabilidad de spec 004 (registro de colaboradores).
- **Posible enmienda al modelo de datos (spec 003)**: La asignación de regla y plantilla a departamentos puede requerir agregar campos de referencia a la entidad `Area`. Si la entidad actual no los tiene, esta enmienda debe tramitarse en la fase de planificación antes de la implementación.
- El override individual parcial (solo regla o solo plantilla) es válido. Si un colaborador tiene override solo de regla, hereda la plantilla del departamento, y viceversa.
- Esta feature depende de spec 004 (registro de colaboradores y departamentos) para que existan entidades a las que asignar configuraciones.
