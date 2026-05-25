# Feature Specification: Gestión de Liquidación Semanal

**Feature Branch**: `006-weekly-payroll`

**Created**: 2026-05-22

**Status**: Draft

## Clarifications

### Session 2026-05-22

- Q: ¿Qué representa `total_descuentos` y quién lo determina en esta feature? → A: Los descuentos son deducciones adicionales que el supervisor aplica libremente (préstamos, anticipos, multas no relacionadas a asistencia). Requieren monto y motivo. Son independientes de las penalidades de horas y tarifa.
- Q: ¿Puede haber más de un bono del mismo tipo en el mismo día para el mismo colaborador? → A: No; solo un bono por tipo por día. Si ya existe, el sistema rechaza el duplicado con mensaje claro y sugiere editar el bono existente.
- Q: ¿Cuándo se crea la liquidación en estado BORRADOR? → A: Automáticamente cuando se procesa el primer marcaje biométrico del colaborador en esa semana. El supervisor siempre encuentra un borrador pre-existente al abrir la vista de revisión.

### Session 2026-05-25

- Q: ¿Cómo se almacenan las horas por día y los ajustes del supervisor (penalidad de horas, estado del día)? → A: Se crea una tabla `DiaLiquidacion` (id, liquidacion_id, fecha, horas_calculadas, horas_ajustadas_supervisor, atraso_detectado, estado_dia, motivo_ajuste). El pipeline de spec 001 inserta/actualiza una fila por día al procesar marcajes; spec 006 lee esas filas para la vista y escribe los ajustes del supervisor.
- Q: ¿El umbral de hora extra (UMBRAL_HORA_EXTRA) aplica por día o por semana? → A: Por día. Si las horas trabajadas en un día superan el umbral configurado (ej. 8h), el excedente de ese día se clasifica como hora extra. La evaluación es día a día, no acumulada semanal.
- Q: ¿Los descuentos adicionales (FR-007B) se aplican a nivel de período o de día? → A: A nivel de día. Un descuento puede operar en dos modos: (1) reducción de tarifa — reemplaza la tarifa horaria solo para ese día específico (ej. se paga 12 bs/h en lugar de 15 bs/h ese día); (2) monto fijo manual — deducción de un importe fijo de la paga de ese día (ej. descuento de 50 bs por anticipo). Ambos requieren motivo. `total_descuentos` en `LiquidacionSemanal` es la suma de todos los descuentos diarios del período.
- Q: ¿Existe la "penalidad de tarifa del período" como concepto separado? → A: No. Se elimina la penalidad de tarifa a nivel de período. Todos los ajustes de tarifa se realizan a nivel de día (descuento diario modalidad TARIFA_DIA en `DiaLiquidacion`). La liquidación semanal consolida únicamente lo definido día a día; no hay override de tarifa para todo el período.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Revisión y Ajuste de Asistencias del Período (Priority: P1)

El supervisor o administrador selecciona un colaborador y una semana laboral, revisa sus
registros de asistencia con las horas calculadas automáticamente desde los marcajes biométricos,
identifica atrasos y aplica ajustes por día: penalidad de horas (fijar horas del día) o
descuento diario (reducción de tarifa del día o monto fijo).

**Why this priority**: Es el núcleo del proceso de liquidación. Sin poder revisar y ajustar
asistencias, no es posible generar liquidaciones confiables ni aplicar las políticas de pago
de la empresa.

**Independent Test**: Dado un colaborador con marcajes biométricos en una semana, el supervisor
puede ajustar las horas de un día con atraso y aplicar una tarifa reducida para ese día.
El total calculado refleja los ajustes inmediatamente.

**Acceptance Scenarios**:

1. **Given** una semana laboral abierta con marcajes biométricos registrados para el colaborador C,
   **When** el supervisor selecciona a C para ese período,
   **Then** el sistema muestra la lista de días del período con: horas calculadas automáticamente
   desde los marcajes, indicador de atraso si el ingreso fue posterior al horario esperado, y
   el estado de cada día (sin revisión / aprobado / con ajuste de horas / con descuento diario).

2. **Given** el día Martes muestra atraso de 45 minutos para el colaborador C,
   **When** el supervisor aplica una penalidad de horas fijando las horas del día en 7 (en lugar
   de 8 calculadas automáticamente),
   **Then** el total de horas del período se recalcula inmediatamente restando la hora ajustada,
   y el día queda marcado como "con ajuste de horas".

3. **Given** el día Miércoles el colaborador C llegó tarde y el supervisor quiere aplicar una tarifa reducida,
   **When** el supervisor aplica un descuento de tarifa diaria fijando 12 bs/h para ese día
   (en lugar de la tarifa vigente de 15 bs/h) con su motivo justificado,
   **Then** el pago de ese día se recalcula usando 12 bs/h solo para ese día, el total del período
   se actualiza, y el día queda marcado como "con descuento diario".

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
   **Then** visualiza: horas ordinarias, horas extra, bonos asignados por día, descuentos diarios
   aplicados (con indicador de modalidad y motivo por día), y total a pagar.

---

### Edge Cases

- ¿Qué pasa si un día del período no tiene ningún marcaje biométrico? → El día aparece como ausente (0 horas). El supervisor puede dejarlo así (ausentismo no remunerado) o justificar con una nota.
- ¿Puede un día tener simultáneamente ajuste de horas y descuento diario? → Sí; son independientes. El cálculo del día usa las horas ajustadas (o calculadas si no hay ajuste) y la tarifa del descuento diario (o la tarifa configurada si no hay descuento de tarifa).
- ¿Qué pasa si ya existe una tarifa específica para ese colaborador (no la global)? → La tarifa configurada del colaborador (en ConfiguracionRegla con aplica_a=COLABORADOR) se usa como base; el descuento diario de modalidad TARIFA_DIA la reemplaza solo para ese día.
- ¿Puede el supervisor modificar la liquidación después de aprobarla? → No; la liquidación aprobada es inmutable. Cualquier corrección posterior requiere una acción de ajuste explícita registrada en auditoría (feature futura).
- ¿Puede el mismo colaborador tener múltiples liquidaciones por el mismo período? → No; el modelo garantiza una única liquidación por colaborador por semana. El borrador se crea automáticamente con el primer marcaje; si ya existe, se continúa editando el mismo registro.
- ¿Qué pasa si la semana laboral está en estado CERRADA antes de aprobar todas las liquidaciones? → El cierre de semana y la aprobación de liquidaciones son acciones independientes; una semana puede cerrarse sin que todas las liquidaciones individuales estén aprobadas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo usuarios con rol ADMINISTRADOR o SUPERVISOR pueden gestionar liquidaciones. El SUPERVISOR solo puede gestionar los colaboradores asignados a su cargo.
- **FR-002**: El sistema DEBE mostrar para cada día del período seleccionado los datos del `DiaLiquidacion` correspondiente: fecha, horas calculadas automáticamente desde marcajes biométricos (`horas_calculadas`), hora de ingreso registrada, indicador de atraso (`atraso_detectado`), y estado del día (`estado_dia`: SIN_REVISION / APROBADO / CON_AJUSTE_HORAS / CON_DESCUENTO). Si no existe `DiaLiquidacion` para un día (sin marcajes), se muestra como ausente con 0 horas.
- **FR-003**: El supervisor DEBE poder aplicar un ajuste de horas en un día específico, fijando manualmente el valor de `horas_ajustadas_supervisor` en el `DiaLiquidacion` del día (valor ≥ 0). El sistema recalcula el total del período al instante usando `horas_ajustadas_supervisor` cuando está presente, o `horas_calculadas` cuando no hay ajuste.
- **FR-005**: El supervisor DEBE poder marcar una asistencia como "aprobado" (sin ajuste), incluso si el sistema detectó un atraso, registrando esta decisión explícita.
- **FR-006**: El sistema DEBE mostrar una advertencia cuando el colaborador no alcanza el umbral mínimo de asistencia configurado para el período. La advertencia es informativa; la decisión de aplicar penalidad es del supervisor.
- **FR-007**: El supervisor DEBE poder asignar bonos al colaborador para días específicos dentro del período: transporte, alimentación o genérico. Cada bono requiere tipo, monto y, para bonos genéricos, una justificación. Solo puede existir un bono por tipo por día; intentar crear un duplicado produce un error con sugerencia de editar el existente.
- **FR-007B**: El supervisor DEBE poder aplicar un descuento a un día específico del período, en dos modalidades mutuamente excluyentes: (a) **reducción de tarifa diaria** — fija una tarifa horaria reducida solo para ese día (reemplaza la tarifa del período para ese día únicamente); (b) **monto fijo** — deduce un importe fijo de la paga de ese día (ej. anticipo, multa). Ambas modalidades requieren motivo. Solo puede existir un descuento por día; si ya existe, el sistema permite editarlo o eliminarlo. `total_descuentos` en `LiquidacionSemanal` es la suma de todos los descuentos diarios del período.
- **FR-008**: El sistema DEBE calcular y mostrar en tiempo real el total de la liquidación. La fórmula por día es: `pago_dia = (horas_ordinarias_dia × tarifa_efectiva_dia) + (horas_extra_dia × tarifa_extra) − descuento_monto_fijo_dia`, donde `horas_efectivas_dia = horas_ajustadas_supervisor ?? horas_calculadas`, `tarifa_efectiva_dia = descuento_valor` si `descuento_tipo = TARIFA_DIA`, o la tarifa configurada del colaborador (o global) en caso contrario, y `descuento_monto_fijo_dia = descuento_valor` si `descuento_tipo = MONTO_FIJO`, o 0 en caso contrario. El total del período es `Σ pago_dia + total_bonos`. El total se actualiza al instante con cada ajuste.
- **FR-009**: El supervisor o administrador DEBE poder aprobar la liquidación del período para un colaborador. Una liquidación aprobada no puede ser modificada.
- **FR-010**: El sistema DEBE crear automáticamente una liquidación en estado BORRADOR para el colaborador al procesar su primer marcaje biométrico de la semana. Si ya existe una liquidación para ese colaborador y período (en cualquier estado), no se crea una nueva.
- **FR-011**: Toda acción de ajuste (ajuste de horas, descuento diario, asignación de bono, aprobación) DEBE quedar registrada en el log de auditoría con el usuario que realizó la acción, timestamp y valores anteriores/nuevos.

### Key Entities

- **Período Semanal**: Semana laboral de sábado a viernes. Es la unidad de liquidación. Solo puede estar abierta o cerrada.
- **Registro de Asistencia Diaria**: Conjunto de marcajes biométricos de un día para un colaborador, del cual se calculan las horas trabajadas y se detectan atrasos.
- **Ajuste de Horas**: Número de horas que el supervisor fija manualmente para un día específico (`horas_ajustadas_supervisor`), reemplazando el valor calculado automáticamente desde biométricos para ese día.
- **Bono del Período**: Pago adicional (transporte, alimentación o genérico) asignado por el supervisor para un día específico dentro del período.
- **Descuento Diario**: Deducción aplicada por el supervisor a un día específico del período. Dos modalidades: (a) reducción de tarifa — tarifa horaria diferente solo para ese día; (b) monto fijo — importe fijo deducido de la paga del día. Requiere motivo. Almacenado en el `DiaLiquidacion` del día. Solo puede haber un descuento por día.
- **Registro Diario de Liquidación (DiaLiquidacion)**: Un registro por colaborador × día × semana. Contiene: fecha del día, horas calculadas automáticamente desde biométricos (`horas_calculadas`), horas que el supervisor fija manualmente (`horas_ajustadas_supervisor`; null = sin ajuste), indicador de atraso detectado (`atraso_detectado`: booleano), estado del día (`estado_dia`: `SIN_REVISION` / `APROBADO` / `CON_AJUSTE_HORAS` / `CON_DESCUENTO`), motivo del ajuste, y campos de descuento diario: `descuento_tipo` (`TARIFA_DIA` | `MONTO_FIJO` | null), `descuento_valor` (tarifa reducida o importe fijo; null si no aplica), `descuento_motivo` (texto; requerido si hay descuento). El pipeline de spec 001 crea/actualiza estas filas al procesar marcajes; spec 006 las lee para la vista de revisión y escribe los ajustes del supervisor. Ver definición completa en `specs/003-mvp-data-model/data-model.md`.
- **Liquidación Semanal**: Resumen final del pago del período: horas contabilizadas, tarifa aplicada, bonos, descuentos y total a pagar. Pasa de BORRADOR a APROBADO. Contiene los totales calculados a partir de los `DiaLiquidacion` del período.

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
- No existe penalidad de tarifa a nivel de período. Todos los ajustes de tarifa son diarios (via `descuento_tipo = TARIFA_DIA` en `DiaLiquidacion`). El ajuste de horas y el descuento diario son independientes y pueden coexistir en el mismo día. La liquidación semanal consolida únicamente lo definido día a día.
- El tipo de bono "genérico" requiere una enmienda al modelo de datos (spec 003), añadiendo el valor `GENERICO` al enum `TipoBono`. Esta enmienda debe tramitarse antes de la implementación.
- La asignación de bonos por día específico requiere verificar si la entidad `Bono` del modelo actual necesita un campo `fecha_dia`. Esta enmienda debe evaluarse en la fase de planificación.
- La liquidación en estado BORRADOR se crea automáticamente cuando el sistema procesa el primer marcaje biométrico del colaborador en esa semana. El supervisor siempre encuentra un borrador pre-existente; no necesita un paso de "crear liquidación".
- Esta feature no incluye el cierre de la semana laboral (acción sobre `SemanaLaboral`); solo gestiona liquidaciones individuales por colaborador.
- Esta feature no incluye la corrección de liquidaciones ya aprobadas; ese caso es una feature futura de ajuste explícito.
- Las horas extra se calculan diariamente: si las horas trabajadas (o ajustadas) en un día superan el valor de `UMBRAL_HORA_EXTRA` en `ConfiguracionRegla` (aplica colaborador específico si existe, o global), el excedente de ese día se clasifica como hora extra. Las `horas_ordinarias` semanales son la suma de `min(horas_dia, umbral)` por día; las `horas_extra` semanales son la suma de `max(horas_dia - umbral, 0)` por día.
