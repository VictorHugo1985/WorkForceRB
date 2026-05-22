# Feature Specification: Control de Eventos Biométricos Duplicados

**Feature Branch**: `011-attendance-dedup`

**Created**: 2026-05-22

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detección y Marcado de Marcaciones Potencialmente Duplicadas (Priority: P1)

Durante el procesamiento de un evento biométrico, el sistema verifica si el colaborador
ya registró una marcación del mismo tipo (entrada o salida) dentro de la ventana de
deduplicación configurada. Si es así, el sistema resalta el nuevo evento como potencial
duplicado para revisión. El evento permanece incluido en el cálculo de horas hasta que
un supervisor, cajero o administrador lo descarte explícitamente. El registro nunca se
elimina.

**Why this priority**: Los relojes biométricos disparan dobles lecturas con frecuencia
(persona que pasa cerca del lector, lector sensible, reflejo). Sin detección y visibilidad
de duplicados, el sistema calcula mal las horas o genera pares entrada-salida incorrectos.
La detección automática con descarte manual garantiza que no se excluyan registros válidos
por error.

**Independent Test**: Se inyectan dos eventos de tipo ENTRADA para el mismo colaborador
con 45 segundos de diferencia. El primero queda en estado PROCESADO; el segundo queda
marcado como potencial duplicado con referencia al primero. El cálculo de horas incluye
ambos eventos hasta que el segundo sea descartado manualmente por supervisor, cajero o
administrador.

**Acceptance Scenarios**:

1. **Given** el colaborador C registró una ENTRADA a las 07:00:10,
   **When** el sistema recibe una segunda ENTRADA del mismo colaborador a las 07:01:30
   (dentro de la ventana de deduplicación de 2 minutos),
   **Then** el segundo evento se almacena con marcador de potencial duplicado, referenciando
   el primer evento como original. El primer evento permanece PROCESADO. El cálculo de horas
   incluye ambos eventos hasta que el segundo sea descartado manualmente por supervisor,
   cajero o administrador.

2. **Given** el colaborador C registró una ENTRADA a las 07:00:10,
   **When** el sistema recibe una SALIDA del mismo colaborador a las 16:05:00
   (distinto tipo de evento),
   **Then** el evento de SALIDA se procesa con normalidad; no se considera duplicado
   porque el tipo de evento es distinto al anterior.

3. **Given** el colaborador C registró una ENTRADA a las 07:00:10,
   **When** el sistema recibe una segunda ENTRADA a las 07:03:00
   (fuera de la ventana de deduplicación de 2 minutos),
   **Then** el segundo evento se procesa como válido. El sistema marca el día como
   con dos entradas consecutivas, para que el supervisor lo revise.

4. **Given** un archivo CSV importado contiene dos registros de ENTRADA para el mismo
   colaborador con 30 segundos de diferencia,
   **When** el sistema procesa la importación,
   **Then** el segundo registro se marca como potencial duplicado con la misma lógica que
   los eventos en tiempo real, y queda incluido en el cálculo hasta ser descartado
   manualmente por supervisor, cajero o administrador.

---

### User Story 2 - Visibilidad de Potenciales Duplicados para Supervisión (Priority: P2)

El supervisor, cajero o administrador puede consultar los eventos biométricos marcados como
potencial duplicado para los colaboradores de su equipo, identificar cuándo ocurrieron y qué
evento original referencian, y actuar sobre ellos.

**Why this priority**: La visibilidad de potenciales duplicados permite auditar la calidad
de los datos biométricos y detectar patrones anómalos (por ejemplo, un reloj que dispara
constantemente dobles lecturas). Sin esta vista, los duplicados son silenciosos e
inauditables y el responsable no puede tomar acción.

**Independent Test**: En el historial del colaborador C para una semana dada, aparecen
listados los eventos marcados como potencial duplicado con la fecha, hora, tipo y
referencia al evento original, diferenciados visualmente de los eventos válidos.

**Acceptance Scenarios**:

1. **Given** el colaborador C tiene eventos marcados como potencial duplicado en la semana W,
   **When** el supervisor, cajero o administrador accede al historial de asistencia del
   colaborador,
   **Then** los eventos potencialmente duplicados aparecen diferenciados visualmente de los
   eventos válidos (resaltados o con indicador de estado), mostrando: fecha, hora, tipo de
   evento, marcador de potencial duplicado y referencia al evento original.

2. **Given** el supervisor consulta el historial de asistencia,
   **When** filtra por estado "Potencial Duplicado",
   **Then** ve únicamente los eventos marcados como potencialmente duplicados del período
   seleccionado, con el detalle de qué evento original referencian y con acciones
   disponibles: Descartar o Confirmar como válido.

---

### User Story 3 - Descarte Manual de Evento Potencial Duplicado (Priority: P3)

El administrador, el supervisor o el cajero puede revisar los eventos marcados como
potencial duplicado y decidir si descartarlos del cálculo de horas o confirmarlos como
válidos. Al descartar un evento, queda excluido de los cálculos; al confirmarlo como
válido, la marca de potencial duplicado se elimina y el evento sigue incluido con
normalidad.

**Why this priority**: La detección automática puede cometer falsos positivos (por ejemplo,
la persona sí salió y regresó dentro de la ventana). El responsable del equipo necesita
poder revisar cada marcación flaggeada y tomar la decisión correcta, sin que el sistema
excluya automáticamente registros válidos.

**Independent Test**: El supervisor revisa la lista de potenciales duplicados del
colaborador C. Descarta el segundo evento de ENTRADA. El evento queda excluido del cálculo
de horas del día y el sistema recalcula. Confirma como válido el segundo evento de ENTRADA
de otro colaborador D. La marca de potencial duplicado desaparece y el evento sigue en el
cálculo.

**Acceptance Scenarios**:

1. **Given** un evento marcado como potencial duplicado,
   **When** el supervisor, cajero o administrador decide descartarlo del cálculo,
   **Then** el evento queda excluido de los cálculos de horas del día afectado; el sistema
   recalcula automáticamente las horas sin ese evento. El descarte queda registrado en el
   log de auditoría con usuario, justificación y timestamp.

2. **Given** un descarte que genera un par entrada-salida inconsistente (p.ej. una entrada
   sin salida correspondiente),
   **When** el sistema recalcula las horas tras el descarte,
   **Then** el sistema muestra una advertencia indicando la inconsistencia pero NO bloquea
   el descarte; el supervisor debe resolver el par desde la vista de asistencia (spec 006).

3. **Given** un evento marcado como potencial duplicado,
   **When** el supervisor, cajero o administrador lo revisa y determina que es un evento
   válido (falso positivo),
   **Then** puede confirmarlo como válido: la marca de potencial duplicado se elimina y el
   evento sigue incluido en el cálculo de horas sin cambios. La confirmación queda
   registrada en el log de auditoría.

---

### Edge Cases

- ¿Qué pasa si hay tres o más eventos del mismo tipo en rápida sucesión? → El primer evento es válido. El segundo y siguientes, dentro de la ventana, se marcan todos como potencial duplicado referenciando el primero.
- ¿La ventana de deduplicación es la misma para ENTRADA y SALIDA? → Sí, la misma ventana aplica a ambos tipos. Es un parámetro único por configuración.
- ¿Qué pasa si la importación CSV incluye exactamente el mismo evento dos veces (mismo timestamp, mismo colaborador, mismo tipo)? → El evento con timestamp idéntico también se marca como potencial duplicado; se considera doble importación del mismo archivo.
- ¿Puede un evento descartado ser eliminado? → No; los registros biométricos son append-only (Principio III de la constitución). Solo pueden cambiar de estado, nunca eliminarse.
- ¿El descarte o la confirmación modifica el evento original? → No; la acción cambia únicamente el estado del evento potencial duplicado. El evento original no se toca.
- ¿Qué pasa si se descarta un potencial duplicado y eso genera un conflicto de pares (dos entradas sin salida)? → El sistema alerta pero permite el descarte; el supervisor debe resolver el par manualmente desde la vista de asistencia (spec 006).
- ¿Puede el supervisor ver potenciales duplicados de colaboradores que no son de su equipo? → No; el acceso está restringido al equipo asignado al supervisor, igual que en el resto del sistema.

## Clarifications

### Session 2026-05-22

- Q: ¿La exclusión del evento potencialmente duplicado del cálculo de horas es automática (en el momento de la detección) o requiere acción manual? → A: Manual. El sistema detecta y resalta (flag visual) los potenciales duplicados. La exclusión del cálculo la realiza explícitamente un supervisor, cajero o administrador mediante la acción de descarte. Hasta que no se descarte, el evento sigue incluido en el cálculo de horas.
- Q: ¿Cómo se representa en el modelo de datos el estado de un evento potencial duplicado antes del descarte manual? → A: Nuevo valor de enum `POTENCIAL_DUPLICADO` en `EstadoResolucion`. Al descartarse manualmente → estado `DUPLICADO`; al confirmarse como válido → estado `PROCESADO`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE detectar automáticamente eventos biométricos potencialmente duplicados durante el procesamiento, tanto para eventos recibidos por webhook (tiempo real) como para eventos importados por CSV, y marcarlos visualmente para revisión.
- **FR-002**: Un evento se considera potencial duplicado si cumple simultáneamente: (a) mismo colaborador, (b) mismo tipo de evento (ENTRADA o SALIDA), y (c) ocurrió dentro de la ventana de deduplicación desde el último evento válido del mismo tipo para ese colaborador.
- **FR-003**: La ventana de deduplicación DEBE ser configurable como parámetro del sistema. El valor por defecto es 2 minutos. La configuración aplica globalmente; no se puede personalizar por colaborador o dispositivo en esta feature.
- **FR-004**: Un evento detectado como potencial duplicado DEBE almacenarse en el sistema con estado `POTENCIAL_DUPLICADO` y con una referencia al evento original válido que lo precedió. El registro no puede eliminarse (append-only).
- **FR-005**: Los eventos en estado `POTENCIAL_DUPLICADO` se incluyen en los cálculos de horas hasta que sean descartados explícitamente por supervisor, cajero o administrador. Solo los eventos en estado `DUPLICADO` (descartados manualmente) quedan excluidos de los cálculos de horas y de la generación de liquidaciones.
- **FR-006**: El supervisor, cajero y el administrador DEBEN poder ver los eventos marcados como potencial duplicado en el historial de asistencia de un colaborador, diferenciados visualmente de los eventos válidos, con la referencia al evento original.
- **FR-007**: El supervisor, cajero y el administrador DEBEN poder filtrar el historial de asistencia por estado de evento (Válido / Potencial Duplicado / Descartado) para un colaborador y período determinados.
- **FR-008**: El administrador, el supervisor y el cajero DEBEN poder descartar un evento potencial duplicado del cálculo de horas o confirmarlo como válido (falso positivo). Ambas acciones requieren una justificación de texto libre.
- **FR-009**: Toda acción de descarte o confirmación como válido DEBE quedar registrada en el log de auditoría: usuario que la realizó, evento afectado, estado anterior, estado nuevo, justificación y timestamp.
- **FR-010**: Tras un descarte, el sistema DEBE recalcular automáticamente las horas del día afectado para el colaborador. Si el recálculo genera un par entrada-salida inconsistente (p.ej. una entrada sin salida intermedia), el sistema DEBE mostrar una advertencia pero NO bloquear el descarte.

### Key Entities

- **Evento Potencial Duplicado**: Evento biométrico en estado `POTENCIAL_DUPLICADO`, marcado automáticamente por el sistema como posible duplicado, que referencia a otro evento válido del mismo tipo y colaborador que lo precedió dentro de la ventana de deduplicación. Permanece incluido en los cálculos hasta que sea descartado (→ `DUPLICADO`) o confirmado como válido (→ `PROCESADO`). No puede eliminarse.
- **Ventana de Deduplicación**: Intervalo de tiempo configurable (por defecto 2 minutos) dentro del cual un segundo evento del mismo tipo y colaborador se clasifica como `POTENCIAL_DUPLICADO`.
- **Descarte**: Acción auditada mediante la cual un supervisor, cajero o administrador transiciona un evento de `POTENCIAL_DUPLICADO` a `DUPLICADO`, excluyéndolo de los cálculos de horas. Requiere justificación obligatoria.
- **Confirmación como válido**: Acción auditada mediante la cual un supervisor, cajero o administrador transiciona un evento de `POTENCIAL_DUPLICADO` a `PROCESADO`, determinando que el flag fue un falso positivo. Requiere justificación obligatoria.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los eventos que cumplen la condición de duplicado son marcados como potencial duplicado automáticamente durante el procesamiento, sin intervención manual, y visibles para revisión en el historial de asistencia.
- **SC-002**: El 100% de los eventos descartados manualmente están excluidos de los cálculos de horas y liquidaciones; ningún evento descartado se incluye en una liquidación semanal.
- **SC-003**: El supervisor, cajero o administrador puede localizar todos los potenciales duplicados de un colaborador para una semana dada en menos de 1 minuto desde la vista de historial.
- **SC-004**: El 100% de los descartes y confirmaciones quedan registrados en el log de auditoría con usuario, justificación y timestamp.
- **SC-005**: Tras un descarte, el cálculo de horas del día afectado se actualiza automáticamente, sin necesidad de acción manual adicional.

## Assumptions

- La detección de duplicados aplica al tipo de evento (ENTRADA o SALIDA) tal como está codificado en el evento biométrico. Si el dispositivo no diferencia tipos de evento, no es posible detectar duplicados por tipo; ese caso es una limitación de hardware fuera del alcance de esta feature.
- La ventana de deduplicación de 2 minutos por defecto es suficiente para el contexto operativo de Imprenta Rosa Betania (turnos de trabajo con entrada y salida claramente separadas). Este valor se ajusta en la configuración del sistema si el comportamiento observado lo requiere.
- La ventana de deduplicación es una configuración global del sistema. La configuración por colaborador o dispositivo queda fuera del alcance de esta feature.
- El descarte solo aplica sobre eventos en estado potencial duplicado. No existe acción directa de "marcar como duplicado" sobre eventos PROCESADO; esa corrección se haría mediante un evento de ajuste explícito (feature futura).
- **Enmienda al modelo de datos requerida (spec 003)**:
  1. Agregar los valores `POTENCIAL_DUPLICADO` y `DUPLICADO` al enum `EstadoResolucion` de `EventoBiometrico`. `POTENCIAL_DUPLICADO` = detectado automáticamente, pendiente de revisión, incluido en cálculos; `DUPLICADO` = descartado manualmente, excluido de cálculos.
  2. Agregar campo `evento_referencia_id` (UUID, nullable, FK a `EventoBiometrico`) en `EventoBiometrico` para referenciar el evento original del cual este es potencial duplicado.
- Esta feature depende de spec 001 (procesamiento de eventos biométricos) para la integración del punto de detección en el pipeline de procesamiento.
- Los eventos potencialmente duplicados detectados durante la importación CSV siguen la misma lógica que los eventos en tiempo real; no hay un comportamiento diferenciado por modalidad de ingreso.
