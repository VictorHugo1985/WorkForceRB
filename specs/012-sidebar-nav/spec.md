# Feature Specification: Sidebar de Navegación por Rol

**Feature Branch**: `012-sidebar-nav`

**Created**: 2026-05-26

**Status**: Draft

## Clarifications

### Session 2026-05-26

- Q: ¿Dónde se ubica la información del usuario y la opción "Cerrar sesión" en el sidebar? → A: Pie del sidebar — ítems de navegación arriba, nombre del usuario y opción de cierre de sesión fijos al fondo del sidebar.
- Q: ¿El indicador de sección activa resalta la sección padre en sub-páginas (e.g., `/colaboradores/nuevo`)? → A: Sí — cualquier URL que comience con el prefijo de la sección resalta ese ítem como activo, independientemente del nivel de profundidad.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceso al Sidebar con Secciones Filtradas por Rol (Priority: P1)

Tras iniciar sesión, el usuario ve en el sidebar de la aplicación únicamente las
secciones a las que su rol tiene acceso. El sidebar permanece visible en todo momento
mientras navega por la aplicación. Al hacer clic en una entrada del sidebar, el usuario
accede a esa sección de forma inmediata.

**Why this priority**: Sin el sidebar visible con las secciones correctas, el usuario
no tiene forma intuitiva de navegar entre las funciones de la aplicación. Es el
mecanismo principal de orientación dentro del sistema.

**Independent Test**: Un usuario con rol SUPERVISOR inicia sesión y ve en el sidebar:
Inicio, Liquidaciones y Cola de Pagos. Al hacer clic en "Liquidaciones" es llevado
a esa sección. No ve en el sidebar las entradas de Colaboradores, Configuración ni
Usuarios del Sistema.

**Acceptance Scenarios**:

1. **Given** un usuario con rol ADMINISTRADOR inicia sesión,
   **When** visualiza el sidebar,
   **Then** el sidebar muestra todas las secciones disponibles:
   Inicio, Colaboradores, Configuración, Liquidaciones, Cola de Pagos y Usuarios del Sistema.

2. **Given** un usuario con rol SUPERVISOR inicia sesión,
   **When** visualiza el sidebar,
   **Then** el sidebar muestra únicamente: Inicio, Liquidaciones y Cola de Pagos.

3. **Given** un usuario con rol CAJERO inicia sesión,
   **When** visualiza el sidebar,
   **Then** el sidebar muestra únicamente: Inicio y Cola de Pagos.

4. **Given** un usuario con rol COLABORADOR inicia sesión,
   **When** visualiza el sidebar,
   **Then** el sidebar muestra únicamente: Inicio. No hay otras entradas disponibles.

5. **Given** el usuario visualiza el sidebar,
   **When** hace clic en cualquier entrada visible,
   **Then** la aplicación navega a esa sección sin recargar la página completa.

---

### User Story 2 - Indicador de Sección Activa en el Sidebar (Priority: P1)

El sidebar indica visualmente en todo momento qué sección está activa. Al cambiar
de sección, el indicador se actualiza de forma inmediata para reflejar la ubicación
actual del usuario dentro de la aplicación.

**Why this priority**: El indicador de ubicación es esencial para la orientación del
usuario. Los operativos (supervisores, cajeros) trabajan durante horas en la app y
necesitan saber en todo momento dónde están para navegar eficientemente.

**Independent Test**: El usuario navega de Inicio a Liquidaciones. El ítem
"Liquidaciones" en el sidebar aparece visualmente destacado como sección activa,
e "Inicio" deja de estar destacado.

**Acceptance Scenarios**:

1. **Given** el usuario está en la sección Liquidaciones,
   **When** visualiza el sidebar,
   **Then** la entrada "Liquidaciones" aparece visualmente diferenciada del resto
   (resaltada, con color distinto o indicador lateral).

2. **Given** el usuario navega a Cola de Pagos,
   **When** el sidebar se actualiza,
   **Then** "Cola de Pagos" aparece como activa y la sección anterior deja de estarlo.

3. **Given** el usuario abre la aplicación directamente en una URL de sección,
   **When** el sidebar se renderiza,
   **Then** el ítem correspondiente a esa URL ya aparece como activo desde el primer render,
   incluyendo sub-páginas (e.g., `/colaboradores/nuevo` activa el ítem "Colaboradores").

---

### User Story 3 - Sidebar Responsive con Menú Colapsado en Mobile (Priority: P2)

En dispositivos móviles o pantallas pequeñas, el sidebar se colapsa para no ocupar
espacio de la pantalla principal. El usuario puede abrirlo mediante un botón (hamburger)
y cerrarlo al seleccionar una sección o al tocar fuera del menú.

**Why this priority**: Los usuarios operativos pueden acceder a la aplicación desde
dispositivos móviles. Sin navegación adaptada, el sidebar taparía el contenido y
haría la app inutilizable en pantallas pequeñas.

**Independent Test**: En una pantalla de 375px de ancho, el sidebar no es visible
por defecto. Al tocar el botón de menú, el sidebar aparece como un drawer lateral.
Al seleccionar una sección, el drawer se cierra y el usuario llega a la sección elegida.

**Acceptance Scenarios**:

1. **Given** el usuario accede desde un dispositivo con pantalla pequeña,
   **When** la aplicación se carga,
   **Then** el sidebar está oculto por defecto y se muestra un botón para abrirlo.

2. **Given** el sidebar está oculto en mobile,
   **When** el usuario toca el botón de menú,
   **Then** el sidebar aparece como un panel lateral superpuesto (drawer) sobre el contenido.

3. **Given** el drawer del sidebar está abierto,
   **When** el usuario selecciona una sección o toca fuera del drawer,
   **Then** el drawer se cierra y el usuario ve el contenido de la sección seleccionada.

4. **Given** el usuario accede desde un dispositivo de escritorio (pantalla grande),
   **When** la aplicación se carga,
   **Then** el sidebar es visible de forma permanente sin necesidad de botón de apertura.

---

### User Story 4 - Información del Usuario Autenticado en el Sidebar (Priority: P2)

El sidebar muestra el nombre del usuario actualmente autenticado y la opción de
cerrar sesión, accesibles desde cualquier sección de la aplicación.

**Why this priority**: El usuario necesita confirmar con qué cuenta está operando
(especialmente en contextos donde varias personas usan el mismo equipo) y poder
salir de la sesión sin necesidad de navegar a una página específica.

**Independent Test**: Un usuario autenticado como "Victor Hugo" ve su nombre en el
sidebar. Al hacer clic en "Cerrar sesión", la sesión termina y el sistema lo lleva
a la pantalla de inicio de sesión.

**Acceptance Scenarios**:

1. **Given** el usuario está autenticado,
   **When** visualiza el sidebar,
   **Then** el sidebar muestra el nombre completo del usuario y sus roles activos
   en algún área visible (encabezado o pie del sidebar).

2. **Given** el usuario visualiza el sidebar,
   **When** hace clic en la opción "Cerrar sesión",
   **Then** la sesión se cierra y el sistema redirige a la pantalla de inicio de sesión.

---

### Edge Cases

- ¿Qué pasa si el usuario tiene múltiples roles? → El sidebar muestra la unión de secciones de todos los roles. El orden de los ítems sigue el orden canónico del mapa de navegación (Inicio → Colaboradores → Configuración → Liquidaciones → Cola de Pagos → Usuarios del Sistema).
- ¿Qué pasa si el usuario solo tiene el rol COLABORADOR y no hay secciones de trabajo disponibles? → El sidebar muestra únicamente "Inicio". No se muestran entradas vacías ni mensajes de error.
- ¿Qué pasa si el usuario accede a una URL de sección a la que no tiene acceso? → El Middleware de protección de rutas redirige al Inicio (responsabilidad de spec 010). El sidebar no necesita manejar este caso.
- ¿Puede el usuario redimensionar o anclar/desanclar el sidebar? → No en esta feature. El comportamiento (fijo en desktop, drawer en mobile) es fijo.
- ¿Qué pasa si el nombre del usuario es muy largo? → El nombre se trunca con elipsis (`…`) para no romper el layout del sidebar.

## Requirements *(mandatory)*

### Functional Requirements

**Sidebar y Navegación**

- **FR-001**: El sidebar DEBE mostrar únicamente las entradas de sección correspondientes
  al rol o roles del usuario autenticado, siguiendo el mapa de navegación definido
  en spec 010 (FR-001). Las secciones sin acceso no aparecen en absoluto.

- **FR-002**: Para usuarios con múltiples roles, el sidebar DEBE mostrar la unión de
  secciones de todos sus roles, ordenadas según el orden canónico:
  Inicio → Colaboradores → Configuración → Liquidaciones → Cola de Pagos → Usuarios del Sistema.

- **FR-003**: Al hacer clic en una entrada del sidebar, la aplicación DEBE navegar
  a esa sección sin recargar la página completa (navegación de cliente).

- **FR-004**: El sidebar DEBE mantener un indicador visual de sección activa que se
  actualice inmediatamente con cada cambio de sección, incluyendo cuando se accede
  directamente a una URL. El indicador se activa para cualquier URL que comience
  con el prefijo de la sección (e.g., `/colaboradores/nuevo` activa "Colaboradores").

**Responsive**

- **FR-005**: En pantallas pequeñas (mobile), el sidebar DEBE estar oculto por defecto
  y accesible mediante un botón de menú (hamburger). Al abrir, se muestra como un
  drawer lateral superpuesto sobre el contenido.

- **FR-006**: El drawer mobile DEBE cerrarse automáticamente cuando el usuario
  selecciona una sección o toca fuera del área del drawer.

- **FR-007**: En pantallas de escritorio (desktop), el sidebar DEBE ser visible de
  forma permanente como panel lateral fijo, sin botón hamburger.

**Información del Usuario**

- **FR-008**: El sidebar DEBE mostrar el nombre completo del usuario autenticado en
  el **pie del sidebar**, fijo al fondo y siempre visible sin necesidad de scroll.
  Si el nombre es demasiado largo para el espacio disponible, se trunca con elipsis.

- **FR-009**: La opción "Cerrar sesión" DEBE ubicarse en el **pie del sidebar**,
  junto al nombre del usuario. Al activarla, se cierra la sesión y el sistema
  redirige a la pantalla de inicio de sesión (spec 005). Los ítems de sección
  ocupan la parte superior del sidebar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los ítems de sección en el sidebar corresponden exactamente
  a las secciones permitidas para el rol del usuario — sin ítems de más ni de menos.

- **SC-002**: El indicador de sección activa se actualiza correctamente en el 100%
  de las transiciones entre secciones, incluyendo navegación directa por URL.

- **SC-003**: En dispositivos mobile, el usuario puede abrir el sidebar, seleccionar
  una sección y llegar a su destino en un máximo de 3 interacciones táctiles.

- **SC-004**: El sidebar es visible y funcional en pantallas desde 320px de ancho
  hasta resoluciones de escritorio sin pérdida de funcionalidad.

- **SC-005**: El nombre del usuario y la opción de cerrar sesión son visibles sin
  necesidad de hacer scroll dentro del sidebar.

## Assumptions

- El mapa de secciones por rol es el definido en spec 010 (FR-001). Esta spec implementa
  el componente visual; spec 010 define las reglas de acceso.
- Los roles del usuario se leen del token de sesión activo al momento del login.
  Los cambios de roles tienen efecto en el siguiente login, no en la sesión actual.
- El breakpoint entre mobile (drawer) y desktop (sidebar fijo) se define durante la
  implementación siguiendo estándares del sistema de diseño existente (MUI).
- El cierre de sesión delega en el mecanismo existente de spec 005; el sidebar solo
  activa esa acción.
- El sidebar no implementa protección de rutas — eso es responsabilidad del Middleware
  de spec 010. El sidebar solo controla qué ítems son visibles.
- El orden canónico de los ítems del menú es fijo y no personalizable por el usuario.
- Esta feature no incluye iconos en el sidebar; puede añadirse en una iteración visual futura.
