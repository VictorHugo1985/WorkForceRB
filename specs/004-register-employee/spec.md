# Feature Specification: Registro de Nuevo Colaborador

**Feature Branch**: `004-register-employee`

**Created**: 2026-05-22

**Status**: Draft

---

## Clarifications

### Session 2026-05-25

- Q: ¿Cómo se modela "área de trabajo"? → A: Tabla catálogo `areas` (id, nombre) con FK `area_id` en `colaboradores`. El admin selecciona de un listado.
- Q: ¿Cómo se presenta el formulario de registro? → A: Wizard multi-paso (pasos secuenciales numerados, validación por paso antes de avanzar).
- Q: ¿El registro es una transacción atómica o puede guardarse parcialmente? → A: Guardado parcial — el colaborador se crea siempre con los campos obligatorios; tarifa, horario y código biométrico se pueden completar después. El wizard advierte sobre configuraciones pendientes al finalizar.
- Q: ¿Cómo se resuelve la tarifa cuando un colaborador no tiene tarifa propia configurada? → A: Lookup en tiempo de cálculo — se usa la `ConfiguracionRegla` de alcance `SISTEMA` vigente al momento de liquidar; no se copia al registro del colaborador.
- Q: ¿Dónde se implementa la lógica de servidor para el registro de colaboradores? → A: Next.js API routes / Server Actions en `apps/web` (consistente con auth y webhook ya en producción).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro Completo de Colaborador Nuevo (Priority: P1)

El administrador registra a un nuevo empleado completando un único flujo: datos personales,
área de trabajo, supervisor asignado, perfil de tarifa salarial, horario laboral y código
biométrico (workno) vinculado al dispositivo. Al finalizar, el colaborador queda activo e
inmediatamente disponible para la resolución de marcajes biométricos.

**Why this priority**: Sin colaboradores registrados, el sistema no puede resolver los
eventos biométricos entrantes ni calcular liquidaciones semanales. Es el bloqueo mínimo para
toda operación del sistema posterior al registro de dispositivos.

**Independent Test**: Dado un colaborador recién creado con workno asignado, el sistema puede
resolver un evento biométrico que llega desde su dispositivo y asociarlo al colaborador correcto.

**UX**: El registro utiliza un wizard multi-paso secuencial (pasos numerados: 1-Datos personales, 2-Área y supervisor, 3-Tarifa, 4-Horario, 5-Código biométrico, 6-Confirmación). Cada paso valida sus campos antes de permitir avanzar. El admin puede retroceder a pasos anteriores.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado,
   **When** completa el wizard de registro (6 pasos) con nombre, apellido, cédula, área de trabajo,
   tarifa horaria y workno + dispositivo, y confirma el registro en el paso final,
   **Then** el colaborador queda activo, su tarifa vigente desde la fecha del día, y su código
   biométrico vinculado al dispositivo seleccionado.

2. **Given** un colaborador recién registrado con workno asignado al dispositivo D,
   **When** llega un evento biométrico con ese workno desde el dispositivo D,
   **Then** el sistema resuelve el evento al colaborador correcto de forma inmediata.

3. **Given** un administrador autenticado,
   **When** intenta registrar un colaborador sin ingresar los campos obligatorios (nombre,
   apellido, cédula, área de trabajo),
   **Then** el sistema rechaza el registro e indica qué campos son requeridos.

---

### User Story 2 - Validación de Unicidad e Integridad (Priority: P2)

El sistema valida que la cédula del nuevo colaborador no esté registrada previamente y que el
workno no esté asignado a otro colaborador activo en el mismo dispositivo.

**Why this priority**: Datos duplicados causarían resoluciones incorrectas de marcajes y
liquidaciones erróneas. La integridad del registro es condición necesaria para la confiabilidad
del sistema.

**Independent Test**: Intentar crear dos colaboradores con la misma cédula produce un rechazo
con mensaje claro; asignar el mismo workno+dispositivo a dos colaboradores distintos también
produce un rechazo.

**Acceptance Scenarios**:

1. **Given** un colaborador existente con cédula X (activo o inactivo),
   **When** el admin intenta registrar otro colaborador con la misma cédula X,
   **Then** el sistema rechaza el registro con un mensaje de error claro indicando la duplicidad.

2. **Given** un workno W ya asignado al dispositivo D para el colaborador A,
   **When** el admin intenta asignar el mismo workno W al dispositivo D para un nuevo
   colaborador B,
   **Then** el sistema rechaza la asignación con un mensaje de error claro.

3. **Given** un workno W ya usado en el dispositivo D1,
   **When** el admin asigna ese mismo workno W al dispositivo D2 (diferente),
   **Then** el registro es exitoso — el workno es único por dispositivo, no globalmente.

---

### User Story 3 - Verificación del Perfil Registrado (Priority: P3)

Tras completar el registro, el administrador puede consultar el perfil completo del colaborador
y verificar que todos los datos, configuraciones y código biométrico asignados son correctos.

**Why this priority**: Permite al administrador confirmar la integridad del registro antes de
que el colaborador comience a marcar asistencia, reduciendo errores operativos.

**Independent Test**: El perfil del colaborador recién creado muestra todos los datos
ingresados: datos personales, área, tarifa horaria vigente, horario laboral y código
biométrico activo con el dispositivo al que pertenece.

**Acceptance Scenarios**:

1. **Given** un colaborador recién registrado,
   **When** el admin consulta su perfil,
   **Then** visualiza: nombre completo, cédula, área de trabajo, supervisor asignado (si aplica),
   tarifa horaria vigente (con fecha de inicio), horario laboral (con fecha de inicio) y
   código(s) biométrico(s) activo(s) con el dispositivo correspondiente.

---

### Edge Cases

- ¿Qué ocurre si no hay dispositivos biométricos registrados al momento del registro? → El paso de asignación de código es omisible con advertencia; el colaborador queda registrado sin código y no podrá resolver marcajes hasta que se le asigne uno.
- ¿Qué ocurre si no hay tarifa salarial global configurada y el admin no asigna una tarifa específica? → El colaborador queda registrado sin tarifa activa; el sistema advierte que no podrá generar liquidaciones hasta que exista una tarifa vigente.
- ¿Puede un colaborador tener códigos en múltiples dispositivos? → Sí; se puede asignar un código por dispositivo; no hay límite de dispositivos por colaborador.
- ¿Puede el admin registrar un colaborador sin asignar supervisor? → Sí; el supervisor es un campo opcional.
- ¿Qué ocurre si la cédula ya existe pero el colaborador previo está inactivo? → El sistema rechaza igualmente; la unicidad de cédula aplica sin importar el estado activo/inactivo.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo usuarios con rol ADMINISTRADOR pueden registrar nuevos colaboradores.
- **FR-002**: El registro DEBE capturar los siguientes campos obligatorios: nombre, apellido, número de cédula y área de trabajo (seleccionada de la tabla catálogo `areas`, FK `area_id`).
- **FR-003**: El registro DEBE permitir asignar un supervisor existente en el sistema (campo opcional).
- **FR-004**: El registro DEBE permitir asignar un perfil de tarifa salarial por hora, vigente desde la fecha de registro. Si no se asigna en el wizard, el colaborador queda sin tarifa propia; al calcular su liquidación el sistema usa la `ConfiguracionRegla` de alcance `SISTEMA` vigente (lookup en tiempo de cálculo). Si tampoco existe tarifa global, el sistema advierte que no puede generar liquidaciones.
- **FR-005**: El registro DEBE permitir configurar el horario laboral del colaborador — horas diarias esperadas y umbral de horas extra — vigente desde la fecha de registro. Si no se configura, el colaborador queda sin horario activo con advertencia; puede configurarse posteriormente.
- **FR-006**: El registro DEBE permitir asignar uno o más códigos biométricos (workno) vinculados cada uno a un dispositivo específico. El paso es omisible; el colaborador queda registrado sin código con advertencia visible y puede asignarse posteriormente.
- **FR-007**: El sistema DEBE rechazar el registro si la cédula ya existe para otro colaborador, activo o inactivo, mostrando un mensaje de error claro.
- **FR-008**: El sistema DEBE rechazar la asignación de un workno si ese código ya está activo para otro colaborador en el mismo dispositivo, mostrando un mensaje de error claro.
- **FR-009**: El colaborador recién registrado DEBE estar activo inmediatamente y disponible para la resolución de eventos biométricos sin demoras.
- **FR-010**: El registro completo (colaborador + tarifa + horario + código biométrico) DEBE quedar registrado en el log de auditoría: quién registró, cuándo, y el resumen de los datos ingresados.

### Key Entities

- **Área**: Catálogo de áreas de trabajo (`areas`). El colaborador referencia su área mediante FK `area_id`.
- **Colaborador**: Trabajador registrado con datos personales (nombre, apellido, cédula) y área de trabajo asignada (FK a `areas`).
- **Perfil de Tarifa Salarial**: Configuración de tarifa horaria específica para el colaborador, con fecha de inicio de vigencia. Se aplica a este colaborador únicamente (sobreescribe la tarifa global para sus liquidaciones).
- **Horario Laboral**: Configuración de horas diarias esperadas y umbral de horas extra del colaborador, con fecha de inicio de vigencia.
- **Código Biométrico**: Vínculo entre un colaborador, un código workno y un dispositivo biométrico específico. Es la clave que permite resolver un marcaje entrante al colaborador correcto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador completa el registro completo de un colaborador nuevo (incluyendo tarifa y código biométrico) en menos de 3 minutos.
- **SC-002**: El 100% de los colaboradores registrados tienen nombre, apellido, cédula y área de trabajo capturados sin excepción.
- **SC-003**: El 100% de los intentos de registro con cédula duplicada son rechazados con mensaje de error comprensible.
- **SC-004**: Los eventos biométricos del colaborador recién registrado son resolubles de forma inmediata — latencia de activación de 0 minutos.
- **SC-005**: El 100% de los registros de colaborador (creación + configuraciones asignadas) quedan trazados en el log de auditoría.

## Assumptions

- El modelo de datos aprobado en `specs/003-mvp-data-model` es el contrato estructural de esta feature.
- Los campos "perfil de tarifa salarial" y "horario laboral" se mapean a la entidad `ConfiguracionRegla` del modelo aprobado (tipos `TARIFA_HORA` / `TARIFA_HORA_EXTRA` / `UMBRAL_HORA_EXTRA`, alcance `COLABORADOR`).
- El campo "área de trabajo" se implementa como FK `area_id` → tabla catálogo `areas` (id, nombre). Requiere una enmienda menor al modelo de datos antes de la implementación, sujeta al proceso de gobernanza de la Constitución.
- Un workno es único por dispositivo, no globalmente: dos dispositivos distintos pueden tener el mismo workno sin conflicto.
- Esta feature cubre únicamente el registro inicial (creación) del colaborador; la edición de datos y la desactivación son features posteriores.
- La carga masiva de colaboradores (importación CSV) está fuera del alcance de esta feature.
- El sistema asume que solo puede existir una SEMANA_LABORAL en estado ABIERTA a la vez; el colaborador registrado participa a partir de la semana activa vigente.
- La implementación de servidor se realiza en Next.js API routes (`apps/web`), consistente con auth y webhook. NestJS (`apps/api`) no está desplegado actualmente.
- La herencia de tarifa y horario globales se resuelve en tiempo de cálculo de liquidación, no en tiempo de registro.
