# Feature Specification: Diseño del Modelo de Datos Relacional del MVP

**Feature Branch**: `003-mvp-data-model`

**Created**: 2026-05-22

**Status**: Draft

**Type**: Architectural Foundation — Database-First Design

> ⚠️ **Bloqueo constitucional**: Según el Principio I de la Constitución, ninguna historia de
> usuario de backend o frontend PUEDE iniciarse sin que este modelo de datos esté definido y
> aprobado. Esta especificación es el prerrequisito bloqueante de todo el desarrollo posterior.

---

## User Scenarios & Testing

### User Story 1 - Definición del Modelo Entidad-Relación del MVP (Priority: P1)

El equipo técnico define el modelo entidad-relación completo del MVP, incluyendo todas las
entidades, sus atributos, tipos, restricciones y relaciones. El resultado es un diccionario de
datos que actúa como contrato estructural entre backend, frontend y base de datos.

**Why this priority**: Sin el modelo aprobado, todo desarrollo posterior es especulativo y
propenso a migraciones disruptivas que la Constitución prohíbe. Es el único desbloqueador de
todas las features del MVP.

**Independent Test**: Dado el modelo publicado, un desarrollador puede responder sin ambigüedad:
¿qué campos tiene la tabla de colaboradores? ¿qué restricciones tiene el registro biométrico?
¿cuál es la clave de relación entre semana laboral y bono?

**Acceptance Scenarios**:

1. **Given** el equipo ha completado el diseño,
   **When** se publica el modelo de datos,
   **Then** todas las entidades del alcance MVP están definidas con nombre, tipo, restricciones
   y relaciones documentadas.

2. **Given** el modelo está publicado,
   **When** un desarrollador consulta el diccionario de datos para la entidad EventoBiométrico,
   **Then** encuentra: nombre de cada campo, tipo de dato, si es obligatorio, si es único,
   valor por defecto si aplica, y la relación con DispositivoBiométrico y Colaborador.

3. **Given** el modelo está publicado,
   **When** se intenta planificar una feature que requiere almacenar un tipo de dato no previsto,
   **Then** el proceso de gobernanza de la Constitución se activa antes de modificar el esquema.

---

### User Story 2 - Aprobación Formal del Modelo (Priority: P2)

El responsable técnico y el administrador del negocio revisan y aprueban formalmente el modelo
de datos. La aprobación queda registrada como precondición del inicio del desarrollo.

**Why this priority**: La Constitución exige aprobación explícita antes de comenzar. Sin este
paso, el modelo no tiene validez como contrato.

**Independent Test**: Existe un registro explícito de aprobación (fecha, responsable) que puede
auditarse.

**Acceptance Scenarios**:

1. **Given** el modelo ha sido presentado al responsable técnico,
   **When** se otorga la aprobación,
   **Then** queda registrada la fecha de aprobación y el nombre del aprobador en la documentación.

2. **Given** el modelo está aprobado,
   **When** se inicia el sprint de implementación,
   **Then** el equipo puede referenciar el modelo como fuente de verdad sin necesidad de
   solicitar confirmación adicional.

---

### User Story 3 - Validación de Compatibilidad de Features Existentes (Priority: P3)

Los specs de features ya creadas (001-webhook-biometric-reception) se validan contra el modelo
aprobado para confirmar que sus entidades propuestas son compatibles o para incorporarlas
formalmente al diccionario.

**Why this priority**: Los specs previos definieron entidades de forma tentativa. El modelo
aprobado es la oportunidad de alinear y consolidar esas definiciones.

**Independent Test**: Cada entidad mencionada en specs previos puede mapearse a una tabla
definida en el modelo, sin contradicciones de nombres, tipos o relaciones.

**Acceptance Scenarios**:

1. **Given** el modelo aprobado y el spec `001-webhook-biometric-reception`,
   **When** se compara la entidad `EventoBiométrico` del spec con el modelo,
   **Then** todos los campos definidos en el spec tienen correspondencia exacta en el diccionario.

---

### Edge Cases

- ¿Qué ocurre si durante el diseño se detecta que una entidad del MVP requiere un campo que
  viola las reglas de normalización? → Documentar la excepción justificada.
- ¿Qué sucede si dos features del MVP requieren estructuras incompatibles? → Resolver en
  diseño antes de aprobar; no dejar conflictos para la implementación.
- ¿Cómo se maneja la evolución del modelo una vez aprobado? → Solo mediante el proceso de
  gobernanza constitucional; las migraciones deben ser reversibles (up/down).

## Requirements

### Functional Requirements

- **FR-001**: El modelo DEBE cubrir todas las entidades necesarias para las 5 áreas del alcance
  del MVP: gestión de usuarios, autenticación, dispositivos biométricos, colaboradores con sus
  códigos biométricos, y auditoría.
- **FR-002**: Cada entidad DEBE tener un diccionario de datos completo: nombre del campo, tipo
  de dato, nulabilidad, unicidad, valor por defecto (si aplica) y descripción de negocio.
- **FR-003**: El modelo DEBE incluir un diagrama entidad-relación que muestre visualmente
  todas las relaciones entre entidades.
- **FR-004**: Cada relación entre entidades DEBE especificar su cardinalidad
  (uno a uno, uno a muchos, muchos a muchos) y las claves foráneas.
- **FR-005**: Las entidades de registro de auditoría DEBEN estar diseñadas como append-only:
  ningún registro existente puede ser modificado ni eliminado.
- **FR-006**: El modelo DEBE ser aprobado formalmente con fecha y responsable registrados
  antes de que comience cualquier implementación de backend o frontend.
- **FR-007**: Toda feature posterior DEBE demostrar compatibilidad con este modelo antes de
  iniciar su planificación; las incompatibilidades activan el proceso de gobernanza.
- **FR-008**: Las reglas de negocio configurables (tarifas, bonos, horarios) DEBEN estar
  representadas en el modelo como entidades versionadas con fecha de vigencia.

### Entidades del MVP a Modelar

Las siguientes entidades deben ser definidas como mínimo para cubrir el alcance del MVP:

| Entidad | Descripción de negocio |
|---|---|
| **Usuario** | Persona con acceso al sistema. Tiene rol (Administrador o Supervisor). |
| **Colaborador** | Trabajador por hora cuya asistencia se registra y se liquida. |
| **CodigoColaborador** | Código que identifica a un colaborador en un dispositivo biométrico específico. |
| **DispositivoBiométrico** | Reloj biométrico registrado en el sistema (webhook o CSV). |
| **EventoBiométrico** | Marcaje registrado por el dispositivo. Append-only. Inmutable. |
| **EventoBiométricoDesglosado** | Marcaje registrado por el dispositivo. Append-only, lecturando todos los campos del cuerpo y registrandolo en campos separados en la entidad. |
| **SemanaLaboral** | Unidad primaria del ciclo de pago. Tiene estado (abierta / cerrada). |
| **ConfiguracionRegla** | Regla de negocio versionada con fecha de vigencia (tarifa, bono, umbral). |
| **Bono** | Bono de transporte o alimentación asignado a un colaborador en un período. |
| **LiquidacionSemanal** | Resultado del cálculo de pago de un colaborador para una semana cerrada. |
| **RegistroAuditoria** | Traza inmutable de acciones críticas del sistema (quién, qué, cuándo). |

### Key Entities

- **Diccionario de Datos**: Documento que describe cada tabla/entidad con todos sus campos,
  tipos, restricciones y relaciones. Es la fuente única de verdad del esquema.
- **Diagrama Entidad-Relación (ERD)**: Representación visual de entidades y sus relaciones.
  Complementa el diccionario; no lo reemplaza.
- **Versión del Modelo**: Identificador que permite saber qué versión del modelo está vigente
  en producción en cada momento, para garantizar recalculabilidad histórica.

## Success Criteria

### Measurable Outcomes

- **SC-001**: El 100% de las entidades del alcance MVP tienen diccionario de datos completo
  (cero campos sin tipo, restricción o descripción definidos) antes del primer sprint de
  implementación.
- **SC-002**: El modelo tiene aprobación registrada con fecha y responsable antes de que
  comience cualquier tarea de implementación de backend.
- **SC-003**: El 100% de las entidades mencionadas en specs existentes
  (001-webhook-biometric-reception) son compatibles con el modelo aprobado o las
  discrepancias están documentadas y resueltas.
- **SC-004**: Cero features del MVP inician implementación sin referenciar el modelo aprobado
  como fuente de verdad.
- **SC-005**: El modelo incluye cobertura para todas las reglas de negocio configurables
  identificadas en la Constitución (tarifas, bonos, umbrales de horas extra).

## Assumptions

- El diseño del modelo se realizará previo al inicio de cualquier sprint de implementación,
  como primera entrega del proyecto.
- El equipo usará el modelo de entidades tentativas ya definidas en los specs previos como
  punto de partida, no como definición final.
- Las migraciones de base de datos derivadas del modelo aprobado serán siempre reversibles
  (up/down), como requiere la Constitución.
- Si surgen conflictos de diseño entre entidades durante el modelado, se resuelven en esta
  fase; no se posponen a la implementación.
- El diccionario de datos resultante vivirá en `specs/003-mvp-data-model/data-dictionary.md`
  y será referenciado por todos los planes de features posteriores.
