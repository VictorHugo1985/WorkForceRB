# Feature Specification: Gestión de Parámetros de Configuración

**Feature Branch**: `022-config-crud-params`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "implementar en la opcion del sidebar Configuracion CRUD para los parametros Area, Tipo de pago y Tipo de Ajuste"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrar Áreas (Priority: P1)

El administrador necesita gestionar las áreas organizacionales (departamentos) de la empresa directamente desde la interfaz, sin requerir intervención técnica. Las áreas son usadas al registrar y editar colaboradores.

**Why this priority**: Las áreas son el catálogo más dinámico — se agregan nuevos departamentos con frecuencia y actualmente se gestionan directamente en la base de datos. Además, ya existe un registro activo de 6 áreas (Acabado, Administración, Artemio, Despacho, Invitaciones, Prensa) que necesitan ser mantenibles.

**Independent Test**: Crear un área nueva "Costura", asignarla a un colaborador desde la pantalla de colaboradores, luego inactivar el área y verificar que el colaborador existente la conserva pero no aparece disponible para nuevas asignaciones.

**Acceptance Scenarios**:

1. **Given** la página de Configuración, **When** el administrador hace clic en "Nueva área" e ingresa el nombre "Logística", **Then** el área aparece en la lista como activa y puede asignarse a colaboradores.
2. **Given** un área existente "Prensa", **When** el administrador la renombra a "Comunicaciones", **Then** el cambio se refleja en todos los colaboradores asignados a esa área.
3. **Given** un área "Artemio" con colaboradores asignados, **When** el administrador la inactiva, **Then** el área se marca inactiva, no aparece en el selector de nuevos colaboradores, pero los colaboradores existentes conservan su área sin cambios.
4. **Given** un área sin colaboradores asignados, **When** el administrador intenta eliminarla, **Then** el área se elimina definitivamente del catálogo.
5. **Given** un área con colaboradores asignados, **When** el administrador intenta eliminarla, **Then** el sistema rechaza la eliminación con mensaje explicativo y sugiere inactivarla en su lugar.

---

### User Story 2 - Administrar Tipos de Ajuste (Priority: P2)

El administrador necesita gestionar los tipos de ajuste disponibles para los días de liquidación (bonos, descuentos, estipendios). Actualmente existen 4 tipos fijos: Bono por Horas Extras, Bono por Transporte, Estipendio, Descuento. El administrador debe poder agregar nuevos tipos, renombrarlos y desactivarlos.

**Why this priority**: Los tipos de ajuste impactan directamente el cálculo de liquidaciones. A medida que el negocio crece, pueden necesitarse nuevos conceptos (ej. "Bono de Alimentación") sin requerir cambios técnicos.

**Independent Test**: Crear el tipo de ajuste "Bono de Alimentación", verificar que aparece disponible al registrar ajustes en una liquidación, luego desactivarlo y confirmar que ya no es seleccionable para nuevas liquidaciones.

**Acceptance Scenarios**:

1. **Given** la página de Configuración, **When** el administrador crea un nuevo tipo "Bono de Alimentación", **Then** el tipo aparece en el catálogo y está disponible en el selector de ajustes de liquidación.
2. **Given** el tipo existente "DESCUENTO", **When** el administrador lo renombra a "Descuento Tardanza", **Then** el cambio se refleja en la interfaz de liquidaciones.
3. **Given** un tipo de ajuste que ya fue usado en liquidaciones pasadas, **When** el administrador lo inactiva, **Then** el tipo se desactiva para nuevos registros pero los registros históricos lo conservan con su nombre original.
4. **Given** un tipo sin uso en liquidaciones, **When** el administrador lo elimina, **Then** se elimina del catálogo definitivamente.

---

### User Story 3 - Administrar Tipos de Período de Pago (Priority: P3)

El administrador puede visualizar y gestionar los tipos de período de pago disponibles para los colaboradores (actualmente: Semanal, Quincenal, Mensual). Estos tipos se asignan a cada colaborador para determinar su frecuencia de liquidación.

**Why this priority**: Los períodos de pago son más estables que las áreas o los tipos de ajuste — en la práctica rara vez se agregan nuevos valores. Sin embargo, el administrador debe poder al menos gestionar su descripción visible y activar/desactivar opciones que ya no se usen.

**Independent Test**: Verificar que los 3 tipos existentes (Semanal, Quincenal, Mensual) son visibles y editables en la pantalla de Configuración, y que un tipo desactivado deja de aparecer en el selector de tipo de pago al crear/editar colaboradores.

**Acceptance Scenarios**:

1. **Given** la página de Configuración, **When** el administrador accede a la sección Tipos de Período de Pago, **Then** ve la lista con los 3 tipos actuales (Semanal, Quincenal, Mensual) y su estado activo.
2. **Given** el tipo "Mensual" está activo, **When** el administrador lo inactiva, **Then** deja de aparecer como opción al crear o editar colaboradores.
3. **Given** que solo existe 1 tipo de pago activo, **When** el administrador intenta inactivarlo, **Then** el sistema rechaza la operación indicando que debe existir al menos un tipo activo.

---

### Edge Cases

- ¿Qué pasa si se intenta crear un área con el mismo nombre que una existente? → El sistema rechaza con error de duplicado.
- ¿Qué pasa si se inactivan todos los tipos de ajuste? → El sistema debe exigir al menos un tipo activo.
- ¿Qué pasa si un colaborador tiene asignado un tipo de pago que luego se inactiva? → El colaborador conserva su tipo pero no puede ser reasignado ese tipo a otros nuevos.
- ¿Qué pasa si un nombre de área o tipo contiene caracteres especiales? → Se permite cualquier texto válido, sin restricciones de caracteres.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La página `/configuracion` DEBE mostrar las tres secciones de gestión: Áreas, Tipos de Ajuste y Tipos de Período de Pago, accesibles únicamente para el rol ADMINISTRADOR.
- **FR-002**: El administrador DEBE poder crear nuevas Áreas con nombre único obligatorio.
- **FR-003**: El administrador DEBE poder renombrar Áreas y Tipos de Ajuste existentes.
- **FR-004**: El administrador DEBE poder activar e inactivar Áreas, Tipos de Ajuste y Tipos de Período de Pago.
- **FR-005**: El sistema DEBE impedir eliminar un Área que tenga colaboradores asignados, mostrando un mensaje claro.
- **FR-006**: El sistema DEBE impedir eliminar o inactivar el último elemento activo de cada catálogo.
- **FR-007**: El administrador DEBE poder eliminar definitivamente Áreas y Tipos de Ajuste que no tengan registros asociados.
- **FR-008**: Los cambios en nombres de Áreas DEBEN reflejarse automáticamente en todas las pantallas que los muestran (colaboradores, liquidaciones).
- **FR-009**: Tipos de Ajuste inactivados NO DEBEN aparecer disponibles en el selector de ajustes de nuevas liquidaciones, pero SÍ DEBEN conservarse en registros históricos.
- **FR-010**: Tipos de Período de Pago inactivados NO DEBEN aparecer en el selector al crear o editar colaboradores.
- **FR-011**: El administrador DEBE poder crear nuevos Tipos de Ajuste con nombre único obligatorio.

### Key Entities

- **Área**: Departamento u área organizacional. Atributos: nombre (único, obligatorio), estado activo/inactivo, fecha de creación. Relación: un colaborador pertenece a una sola área (opcional).
- **Tipo de Ajuste**: Concepto de ajuste aplicable a días de liquidación. Atributos: nombre visible (único, obligatorio), estado activo/inactivo. Relación: un día de liquidación puede tener un tipo de ajuste.
- **Tipo de Período de Pago**: Frecuencia de liquidación del colaborador. Atributos: nombre (Semanal/Quincenal/Mensual), estado activo/inactivo. Relación: cada colaborador tiene un tipo de período de pago.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede crear, renombrar y desactivar un Área en menos de 60 segundos sin asistencia técnica.
- **SC-002**: El administrador puede agregar un nuevo Tipo de Ajuste y verlo disponible en liquidaciones en la misma sesión, sin requerir recarga completa del sistema.
- **SC-003**: Todos los cambios de catálogos son efectivos inmediatamente en las pantallas relacionadas (colaboradores, liquidaciones) sin necesidad de recarga manual.
- **SC-004**: El 100% de los intentos de eliminar elementos con registros asociados es rechazado con un mensaje explicativo, sin pérdida de datos.
- **SC-005**: La página de Configuración carga con todas las secciones visibles en menos de 3 segundos.

## Assumptions

- Solo el rol ADMINISTRADOR tiene acceso a la pantalla de Configuración (ya implementado en el sidebar).
- La página `/configuracion` actualmente muestra "Coming Soon" — esta feature la reemplaza con el contenido real.
- Los tres catálogos se muestran en la misma página `/configuracion`, organizados en secciones separadas (no sub-rutas separadas).
- El Área ya tiene tabla propia en la base de datos con soporte para nombre único y estado activo/inactivo.
- Tipo de Período de Pago y Tipo de Ajuste son actualmente valores fijos del sistema; esta feature los hace administrables desde la UI. Si requieren migración de estructura de datos, eso es responsabilidad del planificador.
- No se registra auditoría para cambios en catálogos de configuración (simplificación de scope).
- No se requiere historial de cambios de nombre — solo el nombre actual es visible.
- El mobile/responsive es out of scope; la pantalla es para uso en desktop por el administrador.
