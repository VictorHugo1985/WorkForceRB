# Feature Specification: Reporte de Horas Trabajadas

**Feature Branch**: `025-worked-hours-report`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "se requiere un reporte de la carga horario o horas trabajadas de los colaboradores, que se pueda tener un vistazo de sus horas trabajadas por mes y semanas, del ultimo trimestre/semestre/ano"

## Clarifications

### Session 2026-11-18

- Q: ¿Qué fuente define las horas trabajadas? → A: Solo las marcaciones biométricas. El reporte muestra únicamente horas trabajadas y no incluye ningún dato de liquidaciones (ni horas ajustadas, ni montos, ni estados).
- Q: ¿Qué roles pueden ver el reporte? → A: ADMINISTRADOR y SUPERVISOR.
- Q: ¿Cómo se definen "último trimestre/semestre/año"? → A: Períodos móviles: mes en curso + los 2, 5 u 11 meses anteriores completos (no trimestres calendario).
- Q: ¿El SUPERVISOR ve a todos los colaboradores o solo a su equipo asignado? → A: A todos, igual que el ADMINISTRADOR (coherente con Evaluaciones y Eventos Biométricos).
- Q: ¿Cómo se señalan en la tabla general los días con marcaciones incompletas? → A: Cada celda muestra un indicador de advertencia con la cantidad de días incompletos de ese tramo (ej. "38.5 h ⚠2"); el detalle diario los identifica.

### Rediseño 2026-11-18 (feedback del usuario tras la primera versión)

- La tabla colaboradores × tramos se reemplaza por **gráficos de columnas**: "Horas por semana" y "Horas por mes" del período elegido, uno debajo del otro.
- Se elige primero el **colaborador** en un selector; **por defecto se muestra el promedio de todos los colaboradores** (activos con al menos una marcación en el período). Al seleccionar un colaborador, los gráficos muestran sus horas y el promedio queda como línea de referencia.
- La vista **siempre abre en el último trimestre** (no se recuerda la última elección).
- Indicadores: horas del período, promedio semanal y mensual (solo tramos completos) y días con marcación incompleta (colaborador) o colaboradores considerados (promedio).
- Se mantienen: fuente solo marcaciones, períodos móviles, tramos parciales y "sin datos", detalle diario al hacer clic en una columna (con un colaborador seleccionado) y una vista de tabla por gráfico para accesibilidad.
- Quedan sin efecto los requisitos de la tabla: FR-009, FR-009a (el ⚠ pasa al tooltip y al detalle), FR-010, FR-011 (los inactivos con horas figuran en el selector), FR-012 (búsqueda en el selector; sin filtro por área ni ordenamiento).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vista general de horas por mes (Priority: P1)

Un usuario autorizado abre la sección "Horas trabajadas" y ve una tabla con todos los colaboradores activos en las filas y los meses del período elegido en las columnas. Cada celda muestra el total de horas trabajadas por ese colaborador en ese mes, y la última columna el total del período. Puede elegir el período: último trimestre (por defecto), último semestre o último año.

**Why this priority**: Es el "vistazo" que se pidió. Permite detectar de un golpe quién trabaja de más o de menos y cómo varía la carga mes a mes.

**Independent Test**: Elegir "Último trimestre" y verificar que aparecen 3 columnas de mes más el total. Comparar las horas de un colaborador en un mes con la suma de sus jornadas diarias de ese mes (calculadas a partir de sus marcaciones).

**Acceptance Scenarios**:

1. **Given** colaboradores con marcaciones en los últimos 3 meses, **When** abro el reporte, **Then** veo por defecto el último trimestre agrupado por mes, con una fila por colaborador activo, horas por mes y total del período.
2. **Given** el reporte abierto, **When** cambio a "Último semestre" o "Último año", **Then** las columnas pasan a 6 o 12 meses y los totales se recalculan.
3. **Given** un colaborador sin marcaciones en un mes, **When** veo ese mes, **Then** la celda muestra 0 h (y no queda vacía ni da error).
4. **Given** un mes anterior al inicio de los registros del sistema, **When** forma parte del período elegido, **Then** se muestra como "sin datos", distinguible de 0 h.
5. **Given** el mes en curso, **When** aparece en el reporte, **Then** está marcado como parcial (horas acumuladas hasta hoy).

---

### User Story 2 - Vista por semanas (Priority: P1)

En el mismo reporte, el usuario cambia la agrupación de "Por mes" a "Por semana" y ve una columna por cada semana (lunes a domingo) del período elegido, con las horas trabajadas de cada colaborador en esa semana.

**Why this priority**: Es parte explícita del pedido (por mes **y** por semanas). El pago es semanal, así que la vista semanal es la que mejor se compara con la operación diaria.

**Independent Test**: Elegir "Último trimestre" + "Por semana", verificar que aparecen unas 13 columnas semanales con su rango de fechas, y que la suma de las semanas de un colaborador coincide con su total del período.

**Acceptance Scenarios**:

1. **Given** el reporte en "Por semana", **When** lo veo, **Then** cada columna muestra el rango de la semana (ej. "03/11 – 09/11") y las horas de cada colaborador.
2. **Given** una semana que cae entre dos meses, **When** se agrupa por semana, **Then** aparece como una sola columna con todas sus horas.
3. **Given** cualquier agrupación, **When** comparo el total del período de un colaborador, **Then** coincide entre la vista por mes y la vista por semana.

---

### User Story 3 - Filtrar y ordenar (Priority: P2)

El usuario puede buscar un colaborador por nombre o cédula, filtrar por área, ordenar por el total del período (de mayor a menor o al revés) y ver una fila de totales y promedios por columna.

**Why this priority**: Con más de 60 colaboradores, encontrar a alguien o ver quiénes concentran más carga requiere filtrar y ordenar. Mejora el uso, pero el reporte ya aporta valor sin esto.

**Independent Test**: Filtrar un área y verificar que solo quedan sus colaboradores y que la fila de totales se recalcula; ordenar por total y verificar el orden.

**Acceptance Scenarios**:

1. **Given** el reporte, **When** filtro por un área, **Then** solo veo colaboradores de esa área y los totales y promedios se recalculan.
2. **Given** el reporte, **When** ordeno por "Total del período", **Then** las filas se ordenan por horas totales.
3. **Given** el reporte, **When** busco por cédula, **Then** veo solo al colaborador correspondiente.
4. **Given** el reporte, **When** activo "Incluir inactivos", **Then** también aparecen los colaboradores dados de baja que tienen horas en el período.

---

### User Story 4 - Detalle diario de un colaborador (Priority: P3)

Desde una celda (colaborador × mes o semana), el usuario abre el detalle con las jornadas día por día de ese colaborador en ese tramo: fecha, primera entrada, última salida, horas del día y si el día tiene marcaciones incompletas. No muestra montos ni datos de pago.

**Why this priority**: Explica de dónde sale cada total y permite detectar errores de marcación; es un complemento del vistazo general.

**Independent Test**: Abrir una celda y verificar que la suma de las horas diarias del detalle coincide con el valor de la celda.

**Acceptance Scenarios**:

1. **Given** una celda con horas, **When** la abro, **Then** veo un listado diario cuya suma es igual al valor de la celda.
2. **Given** un día con una marcación sin pareja (entrada sin salida), **When** aparece en el detalle, **Then** se marca como "incompleto", la marcación sin pareja aporta 0 h y la celda de la tabla general muestra el indicador ⚠.
3. **Given** una celda con el indicador "⚠2", **When** la abro, **Then** el detalle muestra exactamente 2 días marcados como "incompleto".

---

### Edge Cases

- **Turnos que cruzan la medianoche**: si un día termina con una entrada sin pareja y la primera marcación del día siguiente es una salida dentro de las 12 horas, ambas forman una jornada que se asigna a la fecha en que empezó.
- **Marcaciones impares**: dentro de cada día, las marcaciones se emparejan de a dos en orden cronológico (1ª con 2ª, 3ª con 4ª…), sin importar el tipo que haya registrado el reloj; si queda una impar, la última queda sin pareja, aporta 0 h y el día se marca como incompleto.
- **Colaborador dado de alta o de baja a mitad del período**: solo suma las horas de los días en que tiene marcaciones; los meses o semanas sin marcaciones muestran 0 h.
- **Semana en curso o mes en curso**: se muestran como parciales.
- **Período anterior al inicio de los registros**: se muestra "sin datos", no 0 h.
- **Colaborador con varios códigos biométricos o relojes**: se suman todas sus marcaciones.
- **Marcaciones sin colaborador asociado**: se excluyen del reporte.

## Requirements *(mandatory)*

### Functional Requirements

**Período y agrupación**

- **FR-001**: El sistema MUST ofrecer tres períodos: último trimestre (por defecto), último semestre y último año.
- **FR-002**: Los períodos MUST ser móviles (no trimestres/semestres/años calendario) y terminar hoy: el trimestre incluye el mes en curso y los 2 meses anteriores completos; el semestre, el mes en curso y los 5 anteriores; el año, el mes en curso y los 11 anteriores.
- **FR-003**: El sistema MUST permitir agrupar las horas por mes o por semana (lunes a domingo); en la agrupación semanal se incluyen las semanas que tengan al menos un día dentro del período.
- **FR-004**: El mes y la semana en curso MUST identificarse visualmente como parciales.
- **FR-005**: Los meses o semanas anteriores a la primera marcación registrada en el sistema MUST mostrarse como "sin datos".

**Cálculo de horas**

- **FR-006**: Las horas trabajadas de un día MUST calcularse únicamente a partir de las marcaciones biométricas del colaborador, emparejadas de a dos en orden cronológico según las reglas de "Edge Cases" (marcaciones impares y turnos que cruzan la medianoche). El reporte MUST NOT incluir datos de liquidaciones (horas ajustadas, marcaciones manuales o excluidas, montos ni estados).
- **FR-007**: El total de un mes o semana MUST ser la suma de las horas diarias de los días que lo componen; el total del período MUST ser la suma de sus meses (o semanas, recortadas al período) y coincidir en ambas agrupaciones.
- **FR-008**: Las horas MUST mostrarse con un decimal (ej. 42.5 h).

**Presentación**

- **FR-009**: El reporte MUST mostrar una fila por colaborador (apellido, nombre, área) y una columna por mes o semana, más una columna "Total del período".
- **FR-009a**: Cada celda con uno o más días incompletos en su tramo MUST mostrar un indicador de advertencia con la cantidad de días incompletos (ej. "38.5 h ⚠2"); las celdas sin días incompletos muestran solo las horas.
- **FR-010**: El reporte MUST incluir una fila de totales y una de promedio por colaborador para cada columna.
- **FR-011**: Por defecto se muestran solo los colaboradores activos; un filtro MUST permitir incluir a los inactivos que tengan horas en el período.
- **FR-012**: El usuario MUST poder buscar por nombre o cédula, filtrar por área y ordenar por nombre o por total del período.
- **FR-013**: El usuario MUST poder abrir el detalle diario de un colaborador en un mes o semana: fecha, primera entrada, última salida, horas del día e indicador de día incompleto.

**Acceso**

- **FR-014**: El reporte MUST estar disponible para los roles ADMINISTRADOR y SUPERVISOR desde el menú lateral, ambos con visibilidad de todos los colaboradores (sin filtrar por supervisor asignado); los demás roles no lo ven ni pueden acceder por URL.
- **FR-015**: El reporte MUST ser de solo lectura: no modifica marcaciones ni ningún otro dato.

### Key Entities

- **Jornada diaria (derivada)**: Horas trabajadas por un colaborador en una fecha, obtenidas al emparejar sus marcaciones biométricas de ese día. Atributos: colaborador, fecha, primera entrada, última salida, horas, incompleta (sí/no).
- **Tramo del reporte**: Mes calendario o semana (lunes a domingo) dentro del período elegido. Atributos: inicio, fin, etiqueta, parcial (sí/no), sin datos (sí/no).
- **Colaborador** (existente): nombre, apellido, cédula, área, activo.
- **Marcación biométrica** (existente): registro de entrada o salida de un colaborador con fecha y hora.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario autorizado ve las horas por mes de todos los colaboradores del último trimestre en menos de 5 segundos desde que abre la sección.
- **SC-002**: Cambiar de período (trimestre, semestre, año) o de agrupación (mes, semana) actualiza el reporte en menos de 5 segundos para el año completo.
- **SC-003**: Para el 100% de las celdas revisadas, el valor coincide con la suma de las horas diarias de su detalle.
- **SC-004**: El total del período de cada colaborador es idéntico en la vista por mes y en la vista por semana.
- **SC-005**: Para un día de muestra, las horas del reporte coinciden con el cálculo manual a partir de las marcaciones del reloj de ese colaborador.

## Assumptions

- "Carga horaria" y "horas trabajadas" se usan como sinónimos: el reporte muestra horas efectivamente trabajadas. Comparar contra horas esperadas según el horario asignado queda fuera de alcance en esta versión.
- El reporte es independiente de liquidaciones: muestra solo horas trabajadas según las marcaciones del reloj. Las correcciones que se hagan en liquidaciones no lo afectan.
- No se separan horas ordinarias de horas extra; se muestra el total trabajado.
- Los cálculos usan la hora local de operación (GMT-4), igual que el resto del sistema.
- Se incluyen todos los colaboradores (fijos y por hora), porque el reporte es de carga horaria y no de pago.
- Exportar a Excel/PDF y los gráficos quedan fuera de esta versión; el reporte es una tabla en pantalla.
- El sistema tiene marcaciones desde junio de 2026; los meses anteriores se muestran como "sin datos".
- Se reutilizan la autenticación, los roles, las áreas y las reglas de emparejamiento de marcaciones ya existentes.
