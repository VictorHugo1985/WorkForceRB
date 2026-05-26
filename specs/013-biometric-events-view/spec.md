# Feature Specification: Visualizador de Eventos Biométricos

**Feature Branch**: `013-biometric-events-view`

**Created**: 2026-05-26

**Status**: Draft

## Clarifications

### Session 2026-05-26

- Q: ¿El SUPERVISOR ve únicamente los eventos de los colaboradores que tiene asignados, o todos los eventos del sistema? → A: Todos los eventos del sistema — el SUPERVISOR tiene visibilidad equivalente al ADMINISTRADOR en esta vista.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listado de Eventos Biométricos con Filtros Básicos (Priority: P1)

El usuario accede a una vista dedicada que muestra el historial de eventos biométricos
registrados en el sistema. Puede filtrar los eventos por fecha, colaborador y tipo de evento
para localizar rápidamente los registros que le interesan. La lista es paginada y muestra
los eventos más recientes primero.

**Why this priority**: El listado con filtro de fecha y colaborador es la consulta más
frecuente — supervisores y administradores la usan diariamente para verificar asistencia,
detectar ausencias y resolver inconsistencias. Sin esta vista, los datos capturados por el
webhook biométrico (spec 001) no son accesibles para los operativos.

**Independent Test**: Un usuario ADMINISTRADOR abre la vista de eventos, selecciona
el rango de fecha de hoy y hace clic en "Filtrar". La lista muestra únicamente los eventos
del día de hoy, con columnas de fecha/hora, nombre del colaborador, tipo de evento y
dispositivo. Al escribir un nombre en el filtro de colaborador, la lista se estrecha a los
eventos de ese colaborador en el rango de fecha seleccionado.

**Acceptance Scenarios**:

1. **Given** el usuario está autenticado y tiene permiso de ver eventos,
   **When** accede a la vista de eventos biométricos,
   **Then** la vista muestra una tabla con los eventos más recientes primero,
   con las columnas: Fecha y Hora, Colaborador, Tipo de Evento, Dispositivo, Estado.

2. **Given** el usuario está en la vista de eventos,
   **When** selecciona un rango de fechas y hace clic en "Filtrar",
   **Then** la tabla muestra únicamente los eventos registrados dentro de ese rango.

3. **Given** el usuario está en la vista de eventos,
   **When** escribe el nombre o cédula de un colaborador en el campo de búsqueda,
   **Then** la tabla muestra únicamente los eventos correspondientes a ese colaborador.

4. **Given** el usuario está en la vista de eventos,
   **When** selecciona un tipo de evento (por ejemplo, "Entrada"),
   **Then** la tabla muestra únicamente eventos de ese tipo.

5. **Given** el usuario aplica múltiples filtros simultáneamente,
   **When** la lista se actualiza,
   **Then** la tabla muestra solo los eventos que cumplen TODOS los criterios seleccionados.

6. **Given** no hay eventos que coincidan con los filtros aplicados,
   **When** la lista se actualiza,
   **Then** la vista muestra un mensaje de "No se encontraron eventos con los filtros seleccionados", sin errores ni pantallas en blanco.

---

### User Story 2 - Paginación y Ordenamiento (Priority: P1)

El historial de eventos puede contener miles de registros. La vista pagina los resultados
para que la carga sea rápida y el usuario puede navegar entre páginas o ajustar cuántos
registros ver a la vez.

**Why this priority**: Sin paginación, la vista sería inusable con volúmenes reales de datos.
La asistencia diaria genera cientos de eventos — mostrarlos todos sin paginar degradaría
la experiencia y la performance.

**Independent Test**: Con al menos 100 eventos en el sistema, la vista carga en menos de
3 segundos y muestra una primera página de 25 registros. El usuario navega a la siguiente
página y ve los siguientes 25 registros.

**Acceptance Scenarios**:

1. **Given** hay más de 25 eventos en el rango de fecha seleccionado,
   **When** la vista carga los resultados,
   **Then** muestra los primeros 25 eventos y controles de paginación (página actual, total de páginas, botones anterior/siguiente).

2. **Given** el usuario está en la primera página de resultados,
   **When** hace clic en "Siguiente página",
   **Then** la vista muestra los siguientes 25 eventos manteniendo los filtros activos.

3. **Given** el usuario desea ver más registros por página,
   **When** cambia el tamaño de página a 50 o 100,
   **Then** la vista recarga mostrando la cantidad seleccionada de registros por página.

---

### User Story 3 - Filtro por Dispositivo y Estado de Resolución (Priority: P2)

Además de los filtros básicos, el usuario puede filtrar eventos por el dispositivo biométrico
que los registró y por el estado de resolución del evento (resuelto, pendiente, con error).

**Why this priority**: Los administradores necesitan identificar eventos problemáticos
(pendientes, no resueltos) agrupados por dispositivo para detectar fallos de hardware o
colaboradores sin resolución en el sistema. Es útil pero no bloquea el uso básico.

**Independent Test**: El usuario selecciona "Dispositivo: Entrada Principal" y
"Estado: Pendiente" en los filtros. La tabla muestra únicamente los eventos del dispositivo
"Entrada Principal" que no han sido resueltos a un colaborador conocido.

**Acceptance Scenarios**:

1. **Given** el usuario está en la vista de eventos,
   **When** selecciona un dispositivo específico del desplegable,
   **Then** la tabla muestra únicamente eventos registrados por ese dispositivo.

2. **Given** el usuario selecciona el estado "Pendiente",
   **When** la tabla se actualiza,
   **Then** muestra únicamente los eventos cuyo código biométrico no fue resuelto a un colaborador del sistema.

3. **Given** el usuario selecciona el estado "Resuelto",
   **When** la tabla se actualiza,
   **Then** muestra únicamente los eventos que tienen un colaborador identificado correctamente.

---

### Edge Cases

- ¿Qué pasa si el rango de fechas es mayor a 90 días? → La vista aplica el filtro normalmente pero muestra un aviso de que rangos grandes pueden tardar más en cargar.
- ¿Qué pasa si un colaborador tiene el campo nombre vacío (evento con workno sin resolver)? → La columna "Colaborador" muestra el código biométrico (workno) en su lugar, distinguiendo visualmente que es un código sin resolver.
- ¿Qué pasa si no hay dispositivos registrados en el sistema? → El filtro de dispositivo muestra "Sin dispositivos disponibles" y permanece deshabilitado.
- ¿Qué pasa si el colaborador fue dado de baja pero tiene eventos anteriores? → Los eventos históricos siguen siendo visibles con el nombre del colaborador tal como estaba al momento del registro.
- ¿Qué pasa si el usuario limpia todos los filtros? → La vista vuelve a mostrar todos los eventos disponibles para el rol del usuario, ordenados por fecha descendente.

## Requirements *(mandatory)*

### Functional Requirements

**Listado y Filtros Básicos**

- **FR-001**: La vista DEBE mostrar los eventos biométricos en una tabla con las siguientes
  columnas: Fecha y Hora, Colaborador (nombre completo o workno si no resuelto), Tipo de
  Evento, Dispositivo, Estado de Resolución.

- **FR-002**: La vista DEBE ofrecer un filtro de rango de fechas (fecha desde / fecha hasta).
  El valor por defecto al cargar la vista es el día actual.

- **FR-003**: La vista DEBE ofrecer un campo de búsqueda de colaborador que filtre por
  nombre completo o cédula, con coincidencia parcial (búsqueda tipo "contiene").

- **FR-004**: La vista DEBE ofrecer un filtro de tipo de evento con las opciones disponibles
  en el sistema (Entrada, Salida, y otras categorías registradas).

- **FR-005**: Cuando se aplican múltiples filtros simultáneamente, el sistema DEBE aplicar
  todos como condiciones AND — solo se muestran eventos que cumplen todos los criterios.

- **FR-006**: Cuando no hay eventos que coincidan con los filtros, la vista DEBE mostrar un
  mensaje informativo en lugar de una tabla vacía sin explicación.

**Paginación**

- **FR-007**: La vista DEBE paginar los resultados con un tamaño de página predeterminado
  de 25 registros. El usuario DEBE poder cambiar el tamaño de página entre las opciones
  25, 50 y 100 registros.

- **FR-008**: Los controles de paginación DEBEN mostrar la página actual, el total de
  páginas y la cantidad total de registros que coinciden con los filtros.

- **FR-009**: Los eventos DEBEN ordenarse por fecha y hora descendente por defecto
  (los más recientes primero).

**Filtros Avanzados**

- **FR-010**: La vista DEBE ofrecer un filtro de dispositivo con un desplegable que lista
  los dispositivos registrados en el sistema.

- **FR-011**: La vista DEBE ofrecer un filtro de estado de resolución con las opciones:
  Todos, Resuelto, Pendiente.

**Control de Acceso**

- **FR-012**: Solo los usuarios con rol ADMINISTRADOR o SUPERVISOR pueden acceder a la
  vista de eventos biométricos. Los demás roles no ven esta sección en el sidebar.

- **FR-013**: El SUPERVISOR tiene acceso a todos los eventos biométricos del sistema, sin restricción por colaborador asignado. Su vista es equivalente a la del ADMINISTRADOR en esta sección.

### Key Entities

- **EventoBiométrico**: registro primario del evento capturado por el webhook. Incluye
  dispositivo, código biométrico del empleado, colaborador resuelto (o nulo si pendiente),
  estado de resolución y payload completo.

- **EventoBiométricoDesglosado**: detalle del evento con fecha/hora de marcaje,
  tipo de evento (Entrada/Salida), nombre del empleado, número de empleado y datos del dispositivo.

- **Dispositivo**: equipo biométrico que generó el evento, identificado por nombre y número de serie.

- **Colaborador**: empleado del sistema vinculado al evento si el código biométrico fue resuelto.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los resultados filtrados se actualizan en menos de 3 segundos para rangos
  de hasta 30 días, en cualquier condición de red normal.

- **SC-002**: El usuario puede localizar los eventos de un colaborador en un día
  específico en un máximo de 4 interacciones (seleccionar fecha, escribir nombre, aplicar filtro, ver resultado).

- **SC-003**: La vista maneja correctamente hasta 10.000 eventos en el rango seleccionado,
  mostrando los primeros resultados paginados sin degradación perceptible de la interfaz.

- **SC-004**: El 100% de los eventos almacenados en el sistema son accesibles a través
  de los filtros — ningún evento queda inaccesible por limitaciones de la vista.

- **SC-005**: La vista es funcional en dispositivos de escritorio y mobile (responsive),
  con los filtros accesibles sin scroll horizontal en pantallas de 375px o más.

## Assumptions

- Los eventos biométricos ya están siendo capturados y almacenados por el webhook de spec 001.
  Esta feature solo lee datos, no los modifica.
- Los campos disponibles para filtrar son los ya existentes en las tablas `eventos_biometricos`
  y `eventos_biometricos_desglosados` — no se requieren nuevas columnas en la base de datos.
- El tipo de evento sigue el enum `TipoEvento` ya definido en el sistema.
- El estado de resolución se lee del campo `estado_resolucion` de la tabla `eventos_biometricos`.
- CAJERO y COLABORADOR no tienen acceso a esta vista (no aparece en su sidebar).
- La vista es de solo lectura — no permite editar ni eliminar eventos.
- La búsqueda de colaborador por nombre utiliza los datos almacenados en el evento
  (nombre capturado al momento del registro), no el nombre actual del colaborador en caso de cambios.
- El rango de fechas por defecto al entrar a la vista es el día actual (00:00 a 23:59).
