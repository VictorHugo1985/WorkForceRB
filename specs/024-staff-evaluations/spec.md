# Feature Specification: Evaluaciones del Personal

**Feature Branch**: `024-staff-evaluations`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "se requiere registrar evaluaciones del personal, en los que se pueda crear n criterios de evaluacion (puntualidad, orden, limpieza, respeto) y que cada criterio tenga un peso en % para llegar al 100%, esta evaluacion se puede registrar para cualquier trabajador del sistema y queda en su historico"

## Clarifications

### Session 2026-11-18

- Q: ¿Qué escala de puntaje se usa por criterio? → A: Enteros del 1 al 10; el puntaje final ponderado se expresa en la misma escala (ej. 7.85).
- Q: ¿Qué roles pueden registrar evaluaciones y ver el histórico? → A: ADMINISTRADOR y SUPERVISOR. La gestión de criterios y la anulación son solo para ADMINISTRADOR.
- Q: ¿El SUPERVISOR ve todas las evaluaciones del histórico o solo las que registró? → A: Ve el histórico completo de cualquier trabajador, independientemente de quién registró cada evaluación.
- Q: ¿Dónde se gestionan los criterios de evaluación? → A: En una pestaña "Criterios de evaluación" dentro de la sección Configuración existente (solo ADMINISTRADOR).
- Q: ¿Qué muestra la pantalla principal de la sección Evaluaciones? → A: Lista de trabajadores activos con buscador, puntaje promedio, fecha de última evaluación y accesos a "Ver histórico" y "Nueva evaluación".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar criterios de evaluación ponderados (Priority: P1)

Un administrador, desde la pestaña "Criterios de evaluación" de la sección Configuración, define los criterios con los que se evalúa al personal (por ejemplo: Puntualidad, Orden, Limpieza, Respeto). Puede crear tantos criterios como necesite, asignar a cada uno un peso porcentual, editarlos o desactivarlos. El sistema solo considera válida la configuración cuando la suma de los pesos de los criterios activos es exactamente 100%.

**Why this priority**: Sin criterios ponderados no existe una base sobre la cual evaluar; es el prerrequisito de toda la funcionalidad.

**Independent Test**: Crear cuatro criterios con pesos 30% / 20% / 20% / 30%, verificar que el sistema indica que la configuración está completa (100%). Cambiar un peso para que la suma sea 90% y verificar que el sistema indica que la configuración no es válida y no permite registrar evaluaciones.

**Acceptance Scenarios**:

1. **Given** que soy administrador y no existen criterios, **When** creo el criterio "Puntualidad" con peso 30%, **Then** el criterio aparece en la lista y el sistema muestra que la suma actual es 30% de 100%.
2. **Given** criterios activos que suman 100%, **When** consulto la configuración, **Then** el sistema indica que está lista para registrar evaluaciones.
3. **Given** criterios activos que suman un valor distinto de 100%, **When** intento registrar una evaluación, **Then** el sistema lo impide e indica que la configuración de criterios debe sumar 100%.
4. **Given** un criterio que ya fue usado en evaluaciones registradas, **When** lo desactivo o cambio su peso, **Then** las evaluaciones anteriores conservan sin cambios el criterio, el peso y el puntaje con que fueron registradas.
5. **Given** que intento crear un criterio con un nombre que ya existe entre los criterios activos, **When** guardo, **Then** el sistema rechaza el duplicado con un mensaje claro.

---

### User Story 2 - Registrar una evaluación a un trabajador (Priority: P1)

Un evaluador autorizado selecciona a cualquier trabajador registrado en el sistema, asigna un puntaje a cada criterio activo y guarda la evaluación. El sistema calcula automáticamente el puntaje final ponderado según los pesos de cada criterio.

**Why this priority**: Es el valor central de la funcionalidad: dejar constancia formal del desempeño de cada trabajador.

**Independent Test**: Con criterios configurados al 100%, seleccionar un trabajador, calificar todos los criterios, guardar y verificar que el puntaje final mostrado corresponde al promedio ponderado de los puntajes ingresados.

**Acceptance Scenarios**:

1. **Given** criterios activos que suman 100% y un trabajador existente, **When** califico todos los criterios y guardo, **Then** la evaluación queda registrada con fecha, evaluador, puntaje por criterio y puntaje final ponderado.
2. **Given** que estoy registrando una evaluación, **When** dejo algún criterio sin puntaje, **Then** el sistema no permite guardar e indica qué criterios faltan.
3. **Given** que estoy registrando una evaluación, **When** ingreso un puntaje fuera de la escala permitida, **Then** el sistema lo rechaza.
4. **Given** que estoy registrando una evaluación, **When** escribo un comentario general opcional, **Then** el comentario queda guardado junto con la evaluación.
5. **Given** un trabajador inactivo, **When** busco trabajadores para evaluar, **Then** el trabajador no aparece como opción para nuevas evaluaciones (su histórico sigue disponible).

---

### User Story 3 - Consultar el histórico de evaluaciones de un trabajador (Priority: P2)

Un usuario autorizado abre el histórico de un trabajador y ve todas sus evaluaciones en orden cronológico (de la más reciente a la más antigua), con su puntaje final, y puede abrir cada una para ver el detalle por criterio.

**Why this priority**: El histórico permite seguir la evolución del desempeño y respalda decisiones sobre el personal; depende de que existan evaluaciones registradas (US2).

**Independent Test**: Registrar tres evaluaciones a un mismo trabajador en fechas distintas y verificar que aparecen las tres en su histórico, ordenadas por fecha, y que el detalle de cada una muestra los criterios, pesos y puntajes con que fue registrada.

**Acceptance Scenarios**:

1. **Given** un trabajador con evaluaciones registradas, **When** abro su histórico, **Then** veo la lista de evaluaciones con fecha, evaluador y puntaje final, de la más reciente a la más antigua.
2. **Given** el histórico de un trabajador, **When** abro una evaluación, **Then** veo cada criterio con el peso y puntaje registrados en ese momento, el puntaje final y el comentario.
3. **Given** un trabajador sin evaluaciones, **When** abro su histórico, **Then** el sistema indica que aún no tiene evaluaciones.
4. **Given** una evaluación registrada, **When** cualquier usuario intenta modificar sus puntajes, **Then** el sistema no lo permite (la evaluación es un registro permanente).

---

### User Story 4 - Anular una evaluación registrada por error (Priority: P3)

Un administrador puede anular una evaluación registrada por error indicando un motivo obligatorio. La evaluación anulada permanece visible en el histórico marcada como "Anulada" pero deja de contar en los indicadores del trabajador.

**Why this priority**: Corrige errores sin perder trazabilidad; es poco frecuente y no bloquea el uso principal.

**Independent Test**: Anular una evaluación con motivo "Trabajador equivocado" y verificar que aparece como anulada en el histórico, con motivo, usuario y fecha de anulación, y que no se considera en el puntaje promedio del trabajador.

**Acceptance Scenarios**:

1. **Given** una evaluación vigente, **When** el administrador la anula indicando un motivo, **Then** la evaluación queda marcada como anulada con motivo, usuario y fecha de anulación.
2. **Given** que intento anular sin indicar motivo, **When** confirmo, **Then** el sistema no permite la anulación.
3. **Given** un usuario sin rol ADMINISTRADOR, **When** visualiza una evaluación, **Then** no tiene disponible la opción de anular.

---

### Edge Cases

- ¿Qué pasa si se desactivan criterios y la suma de los activos deja de ser 100%? → No se pueden registrar nuevas evaluaciones hasta reajustar los pesos; las evaluaciones existentes no se ven afectadas.
- ¿Qué pasa si se agrega un nuevo criterio después de haber evaluado a trabajadores? → Las evaluaciones anteriores no incluyen el criterio nuevo y su puntaje final no se recalcula.
- ¿Qué pasa si un peso es 0% o negativo? → No se permite; cada criterio activo debe tener un peso mayor a 0% y como máximo 100%.
- ¿Se permiten pesos con decimales? → Sí, hasta dos decimales (por ejemplo 33.33%), siempre que la suma sea exactamente 100.00%.
- ¿Qué pasa si se evalúa dos veces al mismo trabajador el mismo día? → Se permite; cada evaluación es un registro independiente en el histórico.
- ¿Qué pasa si un trabajador es dado de baja? → Su histórico de evaluaciones se conserva y sigue siendo consultable.
- ¿Qué pasa si el administrador cambia los criterios o pesos mientras un evaluador está completando una evaluación? → Al guardar, el sistema detecta que la configuración cambió, no registra la evaluación y pide al evaluador recargar el formulario con los criterios vigentes.
- ¿Qué pasa si se renombra un criterio? → Las evaluaciones anteriores muestran el nombre que tenía el criterio al momento de registrarse.

## Requirements *(mandatory)*

### Functional Requirements

**Criterios de evaluación**

- **FR-001**: El sistema MUST permitir al administrador crear un número ilimitado de criterios de evaluación, cada uno con nombre, descripción opcional y peso porcentual.
- **FR-002**: El sistema MUST permitir editar el nombre, la descripción y el peso de un criterio, y activarlo o desactivarlo.
- **FR-003**: El sistema MUST validar que cada criterio activo tenga un peso mayor a 0% y menor o igual a 100%, con hasta dos decimales.
- **FR-004**: El sistema MUST mostrar en todo momento la suma de pesos de los criterios activos e indicar si alcanza exactamente el 100%.
- **FR-005**: El sistema MUST impedir el registro de evaluaciones mientras la suma de pesos de los criterios activos sea distinta de 100%.
- **FR-006**: El sistema MUST impedir nombres duplicados entre criterios activos (sin distinguir mayúsculas/minúsculas).
- **FR-007**: El sistema MUST NOT permitir eliminar físicamente un criterio que ya fue usado en alguna evaluación; solo podrá desactivarse.

**Registro de evaluaciones**

- **FR-008**: El sistema MUST permitir registrar una evaluación para cualquier trabajador activo del sistema.
- **FR-009**: Cada evaluación MUST incluir un puntaje para cada uno de los criterios activos al momento de registrarla, en una escala de números enteros del 1 al 10 (1 = deficiente, 10 = excelente).
- **FR-010**: El sistema MUST calcular el puntaje final de la evaluación como la suma de (puntaje del criterio × peso del criterio ÷ 100), expresado en la misma escala que los puntajes por criterio y redondeado a dos decimales.
- **FR-011**: Cada evaluación MUST registrar: trabajador evaluado, usuario evaluador, fecha de la evaluación, fecha y hora de registro, comentario general opcional, y para cada criterio su nombre, peso y puntaje tal como estaban al momento de registrar.
- **FR-012**: La fecha de evaluación MUST ser por defecto el día actual, y el evaluador MAY cambiarla a una fecha pasada, pero no a una fecha futura.
- **FR-013**: Una evaluación registrada MUST NOT poder modificarse; cambios posteriores en criterios o pesos no alteran evaluaciones existentes.

**Histórico**

- **FR-014**: El sistema MUST mostrar el histórico de evaluaciones de cada trabajador, ordenado de la más reciente a la más antigua, con fecha, evaluador, puntaje final y estado (vigente/anulada).
- **FR-015**: El sistema MUST permitir ver el detalle de cualquier evaluación del histórico (criterios, pesos, puntajes, puntaje final, comentario).
- **FR-016**: El sistema MUST mostrar en el histórico del trabajador el puntaje promedio de sus evaluaciones vigentes y la fecha de su última evaluación.
- **FR-017**: El histórico de un trabajador MUST conservarse aunque el trabajador quede inactivo.
- **FR-017a**: La pantalla principal de la sección Evaluaciones MUST mostrar la lista de trabajadores activos con buscador por nombre o código, su puntaje promedio (evaluaciones vigentes), la fecha de su última evaluación (o "Sin evaluaciones") y accesos a "Ver histórico" y "Nueva evaluación". Un filtro opcional MUST permitir incluir trabajadores inactivos para consultar su histórico (sin la acción "Nueva evaluación").

**Anulación y trazabilidad**

- **FR-018**: El sistema MUST permitir solo al administrador anular una evaluación, exigiendo un motivo obligatorio y registrando quién y cuándo la anuló.
- **FR-019**: Las evaluaciones anuladas MUST permanecer visibles en el histórico, claramente marcadas, y MUST excluirse del puntaje promedio.
- **FR-020**: El sistema MUST registrar en la auditoría la creación, modificación y desactivación de criterios, y el registro y la anulación de evaluaciones.

**Acceso**

- **FR-021**: La gestión de criterios MUST estar disponible solo para el rol ADMINISTRADOR, en una pestaña "Criterios de evaluación" dentro de la sección Configuración existente.
- **FR-022**: El registro de evaluaciones y la consulta del histórico MUST estar disponibles para los roles ADMINISTRADOR y SUPERVISOR, ambos con visibilidad del histórico completo de cualquier trabajador (incluidas evaluaciones registradas por otros evaluadores); los demás roles no ven la sección ni pueden acceder a ella por URL.
- **FR-023**: La sección de evaluaciones MUST estar accesible desde el menú lateral para los roles autorizados.

### Key Entities

- **Criterio de evaluación**: Aspecto del desempeño que se califica (ej. Puntualidad). Atributos: nombre, descripción, peso porcentual, estado (activo/inactivo).
- **Evaluación**: Registro formal del desempeño de un trabajador en una fecha. Atributos: trabajador evaluado, evaluador, fecha de evaluación, fecha de registro, comentario, puntaje final, estado (vigente/anulada), motivo, usuario y fecha de anulación.
- **Detalle de evaluación**: Puntaje asignado a un criterio dentro de una evaluación. Guarda una copia del nombre y peso del criterio vigentes al momento de evaluar, además del puntaje otorgado. Cada evaluación tiene un detalle por cada criterio activo en ese momento.
- **Trabajador (colaborador)**: Entidad existente del sistema; una evaluación pertenece a exactamente un trabajador, y un trabajador puede tener muchas evaluaciones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un evaluador puede registrar una evaluación completa de un trabajador con 4 criterios en menos de 2 minutos.
- **SC-002**: El 100% de las evaluaciones registradas tiene un puntaje final que coincide con el cálculo ponderado manual de sus puntajes y pesos.
- **SC-003**: El 100% de las evaluaciones conserva sus criterios, pesos y puntajes originales después de cualquier cambio en la configuración de criterios.
- **SC-004**: El histórico de un trabajador con hasta 100 evaluaciones se muestra en menos de 2 segundos.
- **SC-005**: Ningún usuario sin rol autorizado puede ver, registrar o anular evaluaciones, ni gestionar criterios.

## Assumptions

- "Trabajador" corresponde a los colaboradores ya registrados en el módulo de Colaboradores; no se crea una entidad nueva de personal.
- Existe un único conjunto global de criterios para todo el personal (no hay criterios distintos por cargo, área o turno en esta versión).
- Las evaluaciones son ad hoc: se registran cuando el evaluador lo decide; no hay calendario de evaluaciones periódicas, recordatorios ni periodos de evaluación obligatorios en esta versión.
- El trabajador evaluado no ve sus evaluaciones en esta versión (el rol COLABORADOR no tiene acceso a la sección).
- No se requieren firmas, aprobaciones ni flujos de revisión de la evaluación; se registra en un solo paso.
- La evaluación no impacta la liquidación ni los pagos; es solo un registro de desempeño.
- Exportar evaluaciones (Excel/PDF) y reportes comparativos entre trabajadores quedan fuera del alcance de esta versión.
- Se reutiliza el mecanismo de autenticación, roles y auditoría existente.
