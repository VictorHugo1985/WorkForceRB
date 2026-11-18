# Feature Specification: Tipo de Colaborador — Campo Fijo

**Feature Branch**: `019-add-fijo-field`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Actualizar la especificacion 004-register-employee agregando un nuevo campo a la base de datos y el proyecto, llamado fijo, el cual sea una bandera para diferenciar a los colaboradores jornaleros o fijos. Los fijos no entran en la logica de pago calculando sus horas trabajadas."

**Amends**: `specs/004-register-employee/spec.md`

---

## Clarifications

### Session 2026-06-18

- Q: ¿Puede el SUPERVISOR editar la clasificación `fijo`? → A: No. Solo ADMINISTRADOR puede modificarla. SUPERVISOR puede visualizarla pero no cambiarla.
- Q: ¿Los colaboradores `fijo` son excluidos también del cálculo de bonos (transporte, alimentación)? → A: Fuera del alcance de esta feature. El comportamiento de bonos para colaboradores `fijo` se definirá en una spec futura.
- Q: ¿Cómo aparecen los colaboradores `fijo` en la pantalla de liquidación? → A: No aparecen. Los colaboradores `fijo` están completamente ocultos en la vista de liquidaciones.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clasificar Colaborador como Fijo o Jornalero (Priority: P1)

El administrador necesita distinguir entre dos tipos de trabajadores: **jornaleros**, cuya paga se calcula en función de las horas trabajadas (comportamiento actual), y **fijos**, que tienen un salario fijo y NO deben entrar en el cálculo de liquidaciones por horas. Durante el registro o edición de un colaborador, el administrador selecciona el tipo. El tipo queda visible en el perfil del colaborador.

**Why this priority**: Sin esta clasificación, el sistema genera cálculos de liquidación incorrectos para trabajadores de salario fijo. Es el bloqueo base de todas las historias siguientes.

**Independent Test**: Registrar un colaborador marcado como "fijo" y verificar que su perfil muestra el tipo correcto. Registrar otro como "jornalero" y verificar que también aparece correctamente.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado en el formulario de registro de colaborador, **When** selecciona el tipo "fijo" y completa el registro, **Then** el colaborador queda registrado con tipo "fijo" y su perfil lo indica claramente.
2. **Given** un administrador autenticado en el formulario de registro de colaborador, **When** no selecciona ningún tipo explícitamente, **Then** el colaborador queda registrado con tipo "jornalero" (valor por defecto).
3. **Given** un colaborador existente con tipo "jornalero", **When** el administrador edita su perfil y cambia el tipo a "fijo", **Then** el perfil refleja el nuevo tipo inmediatamente y el cambio queda registrado en el historial de auditoría.

---

### User Story 2 - Exclusión de Colaboradores Fijos del Cálculo de Liquidaciones (Priority: P2)

El sistema de liquidaciones omite automáticamente a los colaboradores clasificados como "fijo" al calcular el pago por horas trabajadas. Esto garantiza que los trabajadores de salario fijo no generen liquidaciones erróneas por horas.

**Why this priority**: Es el propósito central del campo `fijo`. Sin esta exclusión, el campo existe pero no tiene efecto funcional.

**Independent Test**: Dado un colaborador "fijo" con marcaciones registradas en la semana activa, ejecutar el cálculo de liquidación semanal y verificar que no se genera ninguna liquidación por horas para ese colaborador.

**Acceptance Scenarios**:

1. **Given** un colaborador clasificado como "fijo" con eventos biométricos registrados en la semana activa, **When** el sistema calcula las liquidaciones de esa semana, **Then** ese colaborador no aparece en ninguna parte de la vista de liquidaciones.
2. **Given** un colaborador clasificado como "jornalero" con eventos biométricos registrados en la semana activa, **When** el sistema calcula las liquidaciones, **Then** ese colaborador sí aparece con sus horas calculadas (comportamiento sin cambios).
3. **Given** un colaborador que cambia de "jornalero" a "fijo" durante la semana activa, **When** se recalcula la liquidación, **Then** el colaborador ya no aparece en el cálculo (la clasificación vigente al momento del cálculo determina el comportamiento).

---

### User Story 3 - Visibilidad del Tipo en el Listado de Colaboradores (Priority: P3)

El administrador puede identificar a simple vista qué colaboradores son fijos y cuáles son jornaleros en el listado de colaboradores, sin necesidad de abrir cada perfil individualmente.

**Why this priority**: Facilita la supervisión operativa y la detección de errores de clasificación antes de que afecten el cálculo de liquidaciones.

**Independent Test**: En el listado de colaboradores, cada entrada muestra una etiqueta o indicador visible que distingue "fijo" de "jornalero".

**Acceptance Scenarios**:

1. **Given** una lista de colaboradores que incluye tanto fijos como jornaleros, **When** el administrador accede al listado, **Then** cada colaborador muestra su tipo de forma distinguible sin necesidad de ingresar a su perfil.
2. **Given** el listado de colaboradores, **When** el administrador aplica un filtro por tipo (fijo / jornalero), **Then** solo aparecen los colaboradores del tipo seleccionado.

---

### Edge Cases

- ¿Qué ocurre con los colaboradores ya registrados antes de esta actualización? → Todos los colaboradores existentes son clasificados automáticamente como "jornalero" (preserva el comportamiento actual sin cambios).
- ¿Un colaborador "fijo" aparece en el dashboard de asistencia? → Sí; el campo `fijo` solo excluye del cálculo de liquidaciones por horas, no del registro ni visualización de marcaciones.
- ¿Puede un colaborador "fijo" tener códigos biométricos y marcaciones? → Sí; el tipo de pago es independiente del registro de asistencia.
- ¿Qué ocurre si se intenta cambiar el tipo de un colaborador con una liquidación ya calculada para la semana activa? → El cambio se registra; las liquidaciones ya generadas no se recalculan automáticamente; el administrador debe regenerar manualmente si corresponde.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Durante el registro de un nuevo colaborador, el sistema DEBE ofrecer la opción de clasificarlo como "fijo" o "jornalero".
- **FR-002**: El valor por defecto para la clasificación de un nuevo colaborador DEBE ser "jornalero", si el administrador no selecciona ningún tipo explícitamente.
- **FR-003**: Solo los usuarios con rol ADMINISTRADOR pueden crear o modificar la clasificación (fijo/jornalero) de un colaborador. Los usuarios con rol SUPERVISOR pueden visualizar la clasificación pero NO modificarla.
- **FR-004**: El sistema DEBE excluir completamente a los colaboradores clasificados como "fijo" del cálculo de liquidaciones basadas en horas trabajadas. Los colaboradores "fijo" NO DEBEN aparecer en ninguna vista de liquidaciones. El comportamiento de bonos (transporte, alimentación) para colaboradores "fijo" está fuera del alcance de esta feature y se definirá en una spec futura.
- **FR-005**: El perfil individual del colaborador DEBE mostrar su clasificación actual (fijo/jornalero) de forma visible.
- **FR-006**: El listado de colaboradores DEBE mostrar la clasificación de cada uno e incluir un filtro por tipo.
- **FR-007**: Cualquier cambio en la clasificación de un colaborador DEBE quedar registrado en el log de auditoría: quién lo realizó, cuándo, y el valor anterior y nuevo.
- **FR-008**: La clasificación "fijo" DEBE asignarse retroactivamente como "jornalero" a todos los colaboradores existentes al momento de la implementación.

### Key Entities

- **Colaborador**: Extiende la entidad existente con el atributo `fijo` (booleano). Valor `true` = salario fijo (excluido de liquidaciones por horas); valor `false` = jornalero (incluido en cálculo de horas). Valor por defecto: `false`.
- **Tipo de Colaborador**: Clasificación operativa de dos valores: **Fijo** (no entra en liquidación de horas) y **Jornalero** (comportamiento actual del sistema).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede clasificar o reclasificar a un colaborador en menos de 30 segundos, sin necesidad de volver a registrarlo.
- **SC-002**: El 100% de los colaboradores clasificados como "fijo" son excluidos del cálculo de liquidaciones por horas — cero colaboradores fijos aparecen en liquidaciones por horas trabajadas.
- **SC-003**: El tipo de cualquier colaborador es visible en su perfil en menos de 5 segundos de carga.
- **SC-004**: El 100% de los cambios de clasificación quedan registrados en el log de auditoría con usuario, fecha/hora, y valores anterior/nuevo.
- **SC-005**: Los colaboradores existentes al momento de la implementación conservan exactamente el mismo comportamiento de liquidación que antes (no se altera ningún cálculo previo).

## Assumptions

- Los colaboradores "fijo" pueden recibir pago por mecanismos externos al sistema (planilla fija, contrato mensual); este sistema simplemente los excluye del cálculo de horas, sin modelar su modalidad de pago alternativa.
- El campo `fijo` aplica a nivel del colaborador, no por semana laboral; un colaborador es siempre fijo o siempre jornalero en un momento dado.
- La clasificación vigente al momento de ejecutar el cálculo de liquidación determina si el colaborador entra o no — no se hace trazabilidad histórica de qué tipo tenía en una semana pasada específica.
- Esta feature no modifica el registro de asistencia ni el dashboard de asistencia; solo afecta el motor de liquidaciones (cálculo de horas trabajadas).
- El comportamiento del motor de bonos (transporte, alimentación) para colaboradores "fijo" está explícitamente fuera del alcance; se abordará en una spec futura.
- El campo "fijo" es un complemento al modelo de datos de `specs/003-mvp-data-model` y a `specs/004-register-employee`. Requiere una migración de base de datos para añadir la columna con valor por defecto `false`.
