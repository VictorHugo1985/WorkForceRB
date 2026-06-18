# Feature Specification: Configuración de Relojes Biométricos

**Feature Branch**: `021-biometric-clock-config`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "crear una opcion en el sidebar: configuracion reloj, que permita agregar, modificar o inactivar los datos de un reloj biometrico, los datos requeridos son los mismos del reloj configurado actualmente"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ver y registrar relojes biométricos (Priority: P1)

El administrador necesita ver la lista de relojes biométricos registrados en el sistema y agregar uno nuevo. Actualmente no existe una pantalla para gestionar estos dispositivos desde la interfaz; la configuración se hace manualmente en la base de datos. La nueva opción "Configuración Reloj" en el sidebar permite al administrador ver todos los dispositivos y registrar nuevos sin intervención técnica.

**Why this priority**: Es el flujo base. Sin poder registrar dispositivos desde la UI no hay gestión posible.

**Independent Test**: Navegar a "Configuración Reloj" → verificar que la lista muestra los relojes existentes → agregar un nuevo reloj con nombre, número de serie y tipo → verificar que aparece en la lista.

**Acceptance Scenarios**:

1. **Given** el administrador está autenticado, **When** hace clic en "Configuración Reloj" en el sidebar, **Then** ve una lista con todos los relojes registrados (activos e inactivos) con su nombre, número de serie, tipo y estado.
2. **Given** el administrador está en la pantalla de configuración de relojes, **When** hace clic en "Agregar reloj" y completa el formulario con nombre, número de serie y tipo de integración, **Then** el nuevo reloj queda registrado, aparece en la lista y está activo.
3. **Given** el administrador intenta registrar un reloj con un número de serie ya existente, **When** guarda el formulario, **Then** el sistema muestra un mensaje de error indicando que el número de serie ya está en uso.

---

### User Story 2 — Modificar datos de un reloj existente (Priority: P2)

El administrador necesita corregir o actualizar los datos de un reloj ya registrado — por ejemplo, cambiar su nombre descriptivo, actualizar el número de serie tras reemplazar el hardware, o actualizar el secreto del webhook.

**Why this priority**: Sin esta funcionalidad, cualquier cambio en el hardware o configuración del dispositivo requeriría intervención manual en la base de datos.

**Independent Test**: Seleccionar un reloj existente → editar su nombre → guardar → verificar que la lista refleja el cambio.

**Acceptance Scenarios**:

1. **Given** el administrador ve la lista de relojes, **When** hace clic en "Editar" en un reloj y modifica su nombre o número de serie, **Then** los cambios se guardan y la lista refleja los datos actualizados.
2. **Given** el administrador edita un reloj de tipo WEBHOOK, **When** actualiza el secreto del webhook, **Then** el nuevo secreto queda guardado y el webhook del reloj usará el nuevo valor al recibir eventos.
3. **Given** el administrador intenta guardar una edición con un número de serie que ya usa otro reloj, **When** confirma el formulario, **Then** el sistema muestra un error de duplicado y no aplica el cambio.

---

### User Story 3 — Inactivar un reloj biométrico (Priority: P3)

El administrador puede inactivar un reloj que dejó de usarse (por ejemplo, un dispositivo dañado o reemplazado). Un reloj inactivo no recibe ni procesa nuevos eventos biométricos, pero su historial de eventos previos se conserva.

**Why this priority**: Importante para el mantenimiento del sistema, pero no bloquea el uso diario. Los relojes inactivos simplemente dejan de recibir eventos.

**Independent Test**: Inactivar un reloj activo → verificar que su estado cambia a "Inactivo" en la lista → verificar que eventos nuevos de ese reloj no se procesan.

**Acceptance Scenarios**:

1. **Given** el administrador ve la lista de relojes, **When** hace clic en "Inactivar" en un reloj activo y confirma, **Then** el reloj pasa a estado "Inactivo" y el cambio se refleja inmediatamente en la lista.
2. **Given** un reloj está inactivo, **When** el administrador hace clic en "Activar", **Then** el reloj vuelve a estado "Activo".
3. **Given** un reloj está inactivo, **When** llega un evento biométrico de ese dispositivo, **Then** el evento no se vincula al reloj y se registra como dispositivo desconocido.

---

### Edge Cases

- ¿Qué ocurre si se intenta inactivar el único reloj activo? El sistema lo permite — el administrador es responsable de mantener al menos un reloj activo.
- ¿Se puede eliminar un reloj permanentemente? No — solo se puede inactivar. Los relojes con historial de eventos no se pueden eliminar para preservar la trazabilidad.
- ¿Qué pasa si el número de serie está vacío? El campo es opcional; se puede registrar un reloj sin número de serie (útil para relojes CSV sin identificador de hardware).
- ¿El secreto del webhook se muestra en la pantalla? Solo se muestra enmascarado. El administrador puede reemplazarlo pero no leerlo en texto plano una vez guardado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar una nueva opción "Configuración Reloj" en el sidebar, visible únicamente para ADMINISTRADOR.
- **FR-002**: La pantalla DEBE listar todos los relojes biométricos registrados (activos e inactivos), mostrando: nombre, número de serie, tipo de integración (WEBHOOK o CSV) y estado (activo/inactivo).
- **FR-003**: El sistema DEBE permitir registrar un nuevo reloj con los campos: nombre (obligatorio), número de serie (opcional), tipo de integración (obligatorio: WEBHOOK o CSV) y secreto webhook (obligatorio si tipo = WEBHOOK, oculto si tipo = CSV).
- **FR-004**: El sistema DEBE validar que el número de serie sea único entre todos los relojes (activos e inactivos) al crear o editar.
- **FR-005**: El sistema DEBE permitir editar los datos de un reloj existente: nombre, número de serie, tipo y secreto webhook.
- **FR-006**: El sistema DEBE permitir inactivar un reloj activo y reactivar uno inactivo mediante un control de estado visible en la lista.
- **FR-007**: El sistema NO DEBE permitir eliminar relojes permanentemente; solo inactivar.
- **FR-008**: El campo "secreto webhook" DEBE mostrarse enmascarado en la pantalla; el usuario puede reemplazarlo pero no leerlo una vez guardado.
- **FR-009**: Toda alta, modificación o cambio de estado DEBE quedar registrada en el historial de auditoría.

### Key Entities

- **Reloj biométrico**: Dispositivo físico que registra marcaciones de asistencia. Tiene un nombre descriptivo, número de serie (identificador de hardware), tipo de integración (WEBHOOK para envío en tiempo real, CSV para importación manual), secreto de autenticación (solo tipo WEBHOOK) y estado activo/inactivo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede registrar un nuevo reloj biométrico en 5 interacciones o menos (sin asistencia técnica ni acceso directo a la base de datos).
- **SC-002**: El resultado de cada operación (alta, edición, cambio de estado) se confirma al usuario en menos de 2 segundos.
- **SC-003**: El 100% de las altas, ediciones y cambios de estado quedan registrados en el historial de auditoría.
- **SC-004**: Un número de serie duplicado es rechazado en el 100% de los intentos, antes de guardar los datos.

## Assumptions

- Solo ADMINISTRADOR puede gestionar relojes biométricos; SUPERVISOR y otros roles no ven la opción en el sidebar.
- El secreto webhook es único por reloj y se genera o ingresa manualmente; el sistema no lo genera automáticamente.
- La eliminación permanente está fuera de alcance para proteger el historial de eventos biométricos vinculados.
- Un reloj inactivo conserva todos sus eventos biométricos históricos; solo deja de recibir nuevos eventos.
- Los tipos de integración disponibles son exactamente dos: WEBHOOK (envío en tiempo real desde el reloj) y CSV (importación manual de archivo).
- "Semanas Laborales" del sidebar ya existe y no se modifica en este feature.
