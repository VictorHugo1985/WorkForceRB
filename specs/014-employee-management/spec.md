# Feature Specification: Gestión Completa de Colaboradores

**Feature Branch**: `014-employee-management`

**Created**: 2026-05-26

**Status**: Draft

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Buscar y ver colaboradores (Priority: P1)

El administrador accede a la sección "Colaboradores" desde el sidebar y ve una lista de todos
los colaboradores del sistema. Puede buscar por nombre, apellido o cédula, y hacer clic en
un colaborador para ver su perfil completo con todos sus datos: área, supervisor, tarifa vigente,
código biométrico y estado.

**Why this priority**: Es el punto de entrada a toda la gestión. Sin la vista de lista no hay
forma de localizar a un colaborador para editarlo o darlo de baja. Es la base del módulo.

**Independent Test**: Ingresar como ADMINISTRADOR → clic en "Colaboradores" en el sidebar →
ver una tabla con al menos un colaborador registrado → buscar por nombre parcial → ver que la
lista se filtra. Hacer clic en un colaborador → ver su perfil con todos los campos.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado,
   **When** hace clic en "Colaboradores" en el sidebar,
   **Then** ve una lista tabular de todos los colaboradores (activos por defecto), con columnas:
   Nombre completo, Cédula, Área, Estado (Activo/Inactivo) y una acción para ver el perfil.

2. **Given** la lista de colaboradores visible,
   **When** el administrador escribe parte del nombre "García" en el campo de búsqueda,
   **Then** la tabla se filtra y muestra solo los colaboradores cuyo nombre o apellido
   contiene "García", sin recargar la página.

3. **Given** la lista de colaboradores visible,
   **When** el administrador hace clic en un colaborador,
   **Then** navega al perfil del colaborador con todos sus datos: datos personales,
   área, supervisor, tarifa vigente, horario, código biométrico y estado activo/inactivo.

4. **Given** la lista de colaboradores visible,
   **When** el administrador activa el filtro "Mostrar inactivos",
   **Then** la lista incluye también los colaboradores dados de baja, diferenciados visualmente.

---

### User Story 2 — Registrar un nuevo colaborador (Priority: P1)

El administrador registra un nuevo colaborador desde la lista (botón "Nuevo colaborador") o
directamente desde el sidebar. El sistema guía el registro paso a paso y al completarlo
muestra el perfil del colaborador creado.

**Why this priority**: La creación ya tiene implementación parcial (wizard 6 pasos, API POST).
Esta historia integra esa funcionalidad existente al flujo del módulo completo:
la lista de colaboradores es el contexto desde el que se inicia el registro.

**Independent Test**: Desde la vista de lista → clic "Nuevo colaborador" → completar wizard
de 6 pasos → al confirmar, redirigir al perfil del colaborador recién creado → el colaborador
aparece en la lista.

**Acceptance Scenarios**:

1. **Given** el administrador en la vista de lista de colaboradores,
   **When** hace clic en "Nuevo colaborador",
   **Then** navega al formulario de registro (wizard multi-paso) con los pasos:
   Datos personales, Área y supervisor, Tarifa, Horario, Código biométrico, Confirmación.

2. **Given** el wizard de registro completado con todos los campos obligatorios,
   **When** el administrador confirma en el paso final,
   **Then** el colaborador queda registrado y el sistema redirige al perfil del colaborador
   recién creado con un mensaje de éxito.

3. **Given** el wizard de registro,
   **When** el administrador intenta registrar una cédula ya existente en el sistema,
   **Then** el sistema muestra un mensaje de error claro antes de confirmar el registro.

---

### User Story 3 — Editar datos de un colaborador (Priority: P2)

Desde el perfil de un colaborador, el administrador puede modificar sus datos: nombre,
apellido, cédula, área de trabajo y supervisor asignado. Los cambios se guardan de forma
inmediata y el perfil se actualiza.

**Why this priority**: Los datos de colaboradores cambian con el tiempo (cambio de área,
actualización de cédula, cambio de supervisor). Sin edición el admin debe crear registros
duplicados o dejar datos desactualizados.

**Independent Test**: Abrir el perfil de un colaborador → clic "Editar" → modificar el área
de trabajo → guardar → el perfil muestra el área actualizada.

**Acceptance Scenarios**:

1. **Given** el administrador en el perfil de un colaborador activo,
   **When** hace clic en "Editar",
   **Then** ve un formulario pre-cargado con los datos actuales del colaborador:
   nombre, apellido, cédula, área y supervisor.

2. **Given** el formulario de edición con datos modificados,
   **When** el administrador guarda los cambios,
   **Then** el perfil se actualiza con los nuevos datos y se muestra un mensaje de confirmación.
   Los campos de tarifa, horario y código biométrico no son editables desde este formulario
   (tienen su propio flujo de configuración).

3. **Given** el formulario de edición,
   **When** el administrador intenta guardar con la cédula de otro colaborador ya existente,
   **Then** el sistema rechaza el cambio y muestra un error de duplicidad.

4. **Given** el formulario de edición,
   **When** el administrador borra el nombre y trata de guardar,
   **Then** el sistema rechaza el guardado e indica que el nombre es requerido.

---

### User Story 4 — Dar de baja a un colaborador (Priority: P2)

El administrador puede desactivar a un colaborador que ya no trabaja en la organización.
El colaborador pasa a estado "Inactivo" y deja de aparecer en las listas por defecto,
pero sus datos históricos (marcajes, liquidaciones) se conservan íntegramente.

**Why this priority**: La baja es necesaria para mantener el directorio limpio cuando hay
rotación de personal. Los datos históricos deben preservarse por razones legales y de auditoría.
Sin esta función, los ex-empleados siguen apareciendo en búsquedas y selectores.

**Independent Test**: Desde el perfil de un colaborador activo → clic "Dar de baja" →
confirmar → el colaborador aparece como Inactivo en su perfil → no aparece en la lista
por defecto → sus marcajes biométricos anteriores siguen visibles en la vista de eventos.

**Acceptance Scenarios**:

1. **Given** el administrador en el perfil de un colaborador activo,
   **When** hace clic en "Dar de baja" y confirma la acción,
   **Then** el colaborador queda con estado Inactivo, el perfil lo refleja visualmente
   y el colaborador deja de aparecer en la lista por defecto.

2. **Given** un colaborador dado de baja,
   **When** el administrador activa el filtro "Mostrar inactivos" en la lista,
   **Then** el colaborador inactivo aparece en la lista diferenciado visualmente (chip/badge "Inactivo").

3. **Given** un colaborador dado de baja,
   **When** llega un nuevo evento biométrico con su código de trabajo,
   **Then** el sistema registra el evento pero lo marca como SIN_RESOLVER (el colaborador está inactivo).

4. **Given** el administrador en el perfil de un colaborador inactivo,
   **When** decide reactivarlo,
   **Then** el colaborador vuelve al estado Activo y aparece de nuevo en la lista por defecto.

---

### Edge Cases

- ¿Qué pasa si se intenta dar de baja a un colaborador que ya está inactivo? → La acción no tiene efecto o muestra advertencia.
- ¿Qué pasa al editar un colaborador inactivo? → Se permite la edición pero se muestra un banner indicando que el colaborador está inactivo.
- ¿Qué pasa si la búsqueda no devuelve resultados? → Mensaje informativo "No se encontraron colaboradores con ese criterio".
- ¿Se puede dar de baja al único administrador activo? → El sistema lo permite (otro administrador podría existir), pero este módulo no valida ese caso.

---

## Requirements *(mandatory)*

### Functional Requirements

**Vista de lista / búsqueda:**

- **FR-001**: El sistema DEBE mostrar una lista paginada de colaboradores accesible desde el sidebar, mostrando nombre completo, cédula, área y estado (activo/inactivo).
- **FR-002**: La lista DEBE filtrar por nombre, apellido o cédula en tiempo real (sin botón "buscar" explícito) a medida que el usuario escribe.
- **FR-003**: Por defecto la lista DEBE mostrar solo colaboradores activos. Un control "Mostrar inactivos" DEBE permitir incluirlos en la vista.
- **FR-004**: La lista DEBE incluir un botón "Nuevo colaborador" que navega al wizard de registro.
- **FR-005**: Cada fila de la lista DEBE permitir navegar al perfil del colaborador.

**Creación:**

- **FR-006**: La creación de colaboradores DEBE seguir el wizard de 6 pasos ya existente (spec 004).
- **FR-007**: Al completar el registro exitosamente, el sistema DEBE redirigir al perfil del colaborador creado.

**Edición:**

- **FR-008**: Desde el perfil de un colaborador, DEBE existir un botón "Editar" accesible solo para ADMINISTRADOR.
- **FR-009**: El formulario de edición DEBE permitir modificar: nombre, apellido, cédula, área de trabajo y supervisor.
- **FR-010**: El sistema DEBE validar unicidad de cédula al editar, excluyendo al colaborador actual.
- **FR-011**: Los campos tarifa, horario y código biométrico NO son editables desde este formulario.

**Baja:**

- **FR-012**: Desde el perfil, DEBE existir un botón "Dar de baja" para colaboradores activos, con una confirmación explícita antes de ejecutar la acción.
- **FR-013**: La baja DEBE ser un cambio de estado lógico (activo → inactivo), sin eliminar datos del colaborador ni su historial.
- **FR-014**: DEBE existir la posibilidad de reactivar un colaborador inactivo desde su perfil.
- **FR-015**: Un colaborador inactivo DEBE dejar de resolver nuevos eventos biométricos.

**Control de acceso:**

- **FR-016**: Todas las operaciones (lista, creación, edición, baja) DEBEN requerir rol ADMINISTRADOR.

### Key Entities

- **Colaborador**: Empleado registrado. Campos: nombre, apellido, cédula (único), área, supervisor (opcional), estado activo/inactivo.
- **Área**: Unidad organizacional a la que pertenece el colaborador.
- **Código biométrico**: Código (workno) vinculado a un dispositivo; permite resolver eventos biométricos al colaborador.
- **Tarifa vigente**: Configuración salarial del colaborador, gestionada por separado.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede localizar a cualquier colaborador por nombre o cédula en menos de 5 segundos desde que inicia la búsqueda.
- **SC-002**: El flujo completo de dar de baja a un colaborador (desde el perfil hasta confirmación) se completa en menos de 3 clics.
- **SC-003**: El flujo de edición de datos básicos (nombre, área, supervisor) se completa en menos de 1 minuto.
- **SC-004**: Los datos históricos (marcajes, liquidaciones) de un colaborador dado de baja permanecen íntegros y accesibles.
- **SC-005**: La vista de lista carga en menos de 2 segundos para un directorio de hasta 500 colaboradores.

---

## Assumptions

- El sidebar ya muestra la entrada "Colaboradores" para ADMINISTRADOR (implementado en spec 012). La ruta `/colaboradores` actualmente solo tiene `/colaboradores/nuevo`; este spec añade la lista en `/colaboradores`.
- La creación (wizard 6 pasos) está implementada en spec 004 y no se modifica, solo se integra al flujo del módulo completo.
- La baja es un cambio de estado lógico (`activo = false`). No hay eliminación física de registros.
- La edición de tarifa, horario y código biométrico queda fuera de este spec — tienen flujos propios más complejos que se especificarán por separado.
- La reactivación de colaboradores inactivos es la operación inversa a la baja: cambiar `activo = true`.
- El rol SUPERVISOR no puede gestionar colaboradores — solo ADMINISTRADOR.
