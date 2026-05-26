# Feature Specification: Navegación de la Aplicación Web por Rol

**Feature Branch**: `010-role-based-nav`

**Created**: 2026-05-22

**Status**: Draft

## Clarifications

### Session 2026-05-22

- Q: ¿Qué muestra la sección Inicio para cada rol? → A: Pantalla de bienvenida estática con accesos directos a las secciones del rol. Sin datos en vivo ni estadísticas. El contenido es el mismo para todos los roles, adaptado solo por los accesos disponibles.
- Q: ¿Qué alcance tiene la cláusula "sin pérdida de datos no guardados si es posible" de FR-006? → A: La spec de navegación solo garantiza la redirección al login. La preservación de datos de formulario es responsabilidad de cada feature individual; la navegación no asume esa responsabilidad.

### Session 2026-05-26

- Q: ¿En qué capa de Next.js se implementa la protección de rutas (FR-004/FR-005)? → A: Next.js Middleware (`middleware.ts`) — intercepta cada request en el edge, verifica el JWT del cookie y redirige antes del render. Protección hermética sin flash de contenido.
- Q: ¿Cómo detecta el cliente la expiración de sesión mientras el usuario navega (FR-006)? → A: Timer client-side: al cargar la sesión, calcula `exp - now` del JWT y programa un `setTimeout` que redirige al login cuando expira. Sin polling.
- Q: ¿Qué alcance tiene la persistencia de estado de sección al volver a ella (US4)? → A: Sin persistencia de estado — US4 se limita al indicador visual de sección activa. Las secciones siempre cargan con su estado por defecto; preservar filtros/scroll es responsabilidad de cada feature individual.
- Q: ¿La navegación debe ser responsive (mobile)? → A: Sí — responsive con menú colapsado: el mismo componente se adapta a pantallas pequeñas con patrón hamburger/drawer en mobile y menú completo en desktop.
- Q: ¿Cómo define el Middleware la tabla de rutas → roles requeridos? → A: Tabla estática en `middleware.ts` — objeto de configuración que mapea prefijos de ruta a roles permitidos. Sin BD, evaluable en el edge sin latencia adicional.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegar con Acceso Filtrado por Rol (Priority: P1)

Tras iniciar sesión, el usuario ve únicamente las secciones de la aplicación que
corresponden a su rol. La navegación principal muestra solo las opciones disponibles
para él; las secciones de otros roles no aparecen ni son accesibles.

**Why this priority**: Sin filtrado de navegación por rol, cualquier usuario podría
ver y acceder a secciones que no le corresponden, comprometiendo la seguridad y
generando confusión operativa.

**Independent Test**: Un usuario con solo el rol SUPERVISOR inicia sesión y ve en
el menú principal únicamente: Inicio, Liquidaciones y Pagos (solo lectura). No ve
las secciones de Colaboradores, Configuración ni Usuarios del Sistema.

**Acceptance Scenarios**:

1. **Given** un usuario con rol SUPERVISOR inicia sesión,
   **When** visualiza el menú de navegación principal,
   **Then** el menú muestra únicamente las secciones permitidas para SUPERVISOR:
   Inicio, Liquidaciones y Pagos.

2. **Given** un usuario con rol CAJERO inicia sesión,
   **When** visualiza el menú de navegación principal,
   **Then** el menú muestra únicamente: Inicio y Cola de Pagos.

3. **Given** un usuario con rol ADMINISTRADOR inicia sesión,
   **When** visualiza el menú de navegación principal,
   **Then** el menú muestra todas las secciones: Inicio, Colaboradores,
   Configuración, Liquidaciones, Cola de Pagos y Usuarios del Sistema.

4. **Given** un usuario con rol COLABORADOR inicia sesión,
   **When** visualiza la aplicación,
   **Then** ve únicamente la sección Inicio con la pantalla de bienvenida; no hay
   accesos directos a otras secciones porque no tiene ninguna disponible en el MVP.
   Las demás secciones no aparecen en el menú.

---

### User Story 2 - Protección de Rutas por Rol (Priority: P1)

El sistema impide el acceso directo a una URL de una sección restringida, incluso
si el usuario la conoce o la escribe manualmente. El acceso no autorizado redirige
al usuario a una pantalla apropiada sin mensajes de error técnico.

**Why this priority**: La navegación visible filtra las opciones, pero sin protección
de rutas el usuario podría acceder directamente a URLs restringidas. La protección
de rutas cierra esa brecha de seguridad.

**Independent Test**: Un usuario con rol CAJERO intenta acceder directamente a la
URL de la sección Colaboradores escribiéndola en el navegador. El sistema lo redirige
a Inicio sin mostrar ningún dato de esa sección.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con rol CAJERO,
   **When** intenta acceder directamente a la URL de la sección Colaboradores,
   **Then** el sistema redirige al usuario a su pantalla de Inicio sin mostrar
   ningún contenido de la sección restringida.

2. **Given** cualquier usuario,
   **When** intenta acceder a cualquier URL de la aplicación sin sesión activa,
   **Then** el sistema redirige inmediatamente a la pantalla de inicio de sesión
   (spec 005), preservando la URL destino para redirigir tras el login exitoso.

3. **Given** la sesión del usuario expira mientras navega la aplicación,
   **When** intenta realizar cualquier acción o navegar a otra sección,
   **Then** el sistema redirige al inicio de sesión indicando que la sesión expiró.

---

### User Story 3 - Navegación con Múltiples Roles (Priority: P2)

Un usuario con más de un rol asignado accede a la unión de secciones de todos sus
roles. La navegación refleja automáticamente todos sus permisos sin requerir que
el usuario "cambie de rol" manualmente.

**Why this priority**: La especificación de cuentas de usuario (spec 009) permite
múltiples roles. La navegación debe resolver este caso de forma transparente para
que el usuario no tenga fricciones al operar con varias responsabilidades.

**Independent Test**: Un usuario con roles SUPERVISOR + CAJERO ve en el menú:
Inicio, Liquidaciones (con sus permisos de supervisor) y Cola de Pagos (con acceso
completo de cajero).

**Acceptance Scenarios**:

1. **Given** un usuario con roles SUPERVISOR y CAJERO inicia sesión,
   **When** visualiza el menú de navegación,
   **Then** el menú muestra la unión de secciones de ambos roles: Inicio,
   Liquidaciones y Cola de Pagos.

2. **Given** un usuario tiene roles ADMINISTRADOR y SUPERVISOR,
   **When** accede a la sección Liquidaciones,
   **Then** opera con los permisos más amplios disponibles entre sus roles
   (el ADMINISTRADOR puede ver todas las liquidaciones, no solo las del supervisor).

3. **Given** un usuario con múltiples roles,
   **When** visualiza su perfil de usuario en la aplicación,
   **Then** puede ver la lista de todos sus roles activos.

---

### User Story 4 - Persistencia de Navegación y Estado Activo (Priority: P3)

El usuario puede identificar en todo momento en qué sección se encuentra. Al navegar
entre secciones, la aplicación indica visualmente la sección activa en el menú y
preserva el contexto de cada sección al volver a ella.

**Why this priority**: Una navegación clara reduce la desorientación y el tiempo
perdido. Los usuarios operativos (supervisores, cajeros) trabajan con la aplicación
durante horas; la claridad de ubicación mejora la eficiencia.

**Independent Test**: El usuario navega de Liquidaciones a Cola de Pagos y vuelve
a Liquidaciones. El menú marca visualmente la sección activa en cada paso.

**Acceptance Scenarios**:

1. **Given** el usuario está en la sección Liquidaciones,
   **When** visualiza el menú de navegación,
   **Then** la entrada "Liquidaciones" del menú aparece visualmente destacada como
   sección activa.

2. **Given** el usuario navega a una sección distinta,
   **When** vuelve a una sección visitada anteriormente,
   **Then** la sección se carga con su estado por defecto. El indicador de sección
   activa en el menú se actualiza correctamente. La preservación de filtros o scroll
   es responsabilidad de cada feature individual, no de esta spec.

---

### Edge Cases

- ¿Qué pasa si los roles del usuario cambian mientras tiene sesión activa? → La sesión activa refleja los roles al momento del login. El cambio de roles tiene efecto en el próximo inicio de sesión (consistente con spec 009 FR-007).
- ¿Qué pasa si un usuario con rol COLABORADOR no tiene ninguna sección de trabajo asignada en el MVP? → Ve la sección Inicio con la pantalla de bienvenida sin accesos directos. Las secciones futuras del rol aparecerán como accesos directos en Inicio cuando se definan, sin modificar el comportamiento base de la pantalla.
- ¿Puede el usuario marcar secciones como favoritas o personalizar el menú? → No en esta feature; el menú es determinado exclusivamente por los roles asignados, sin personalización.
- ¿Qué sección se muestra por defecto tras el login? → La sección Inicio para todos los roles, desde donde el usuario elige su destino.
- ¿Qué pasa si la URL destino guardada (pre-login) pertenece a una sección a la que el usuario ya no tiene acceso? → Se ignora la URL destino y se redirige al Inicio.
- ¿Puede el usuario abrir varias pestañas del navegador con distintas secciones? → Sí; cada pestaña funciona de forma independiente dentro de la misma sesión.

## Requirements *(mandatory)*

### Functional Requirements

**Mapa de Navegación por Rol**

- **FR-001**: El sistema DEBE mostrar en el menú de navegación principal únicamente las secciones correspondientes al rol o roles del usuario autenticado, de acuerdo con el siguiente mapa:

  | Sección                | ADMINISTRADOR | SUPERVISOR     | CAJERO        | COLABORADOR |
  |------------------------|:-------------:|:--------------:|:-------------:|:-----------:|
  | Inicio                 | ✓             | ✓              | ✓             | ✓           |
  | Colaboradores          | ✓             | —              | —             | —           |
  | Configuración          | ✓             | —              | —             | —           |
  | Liquidaciones          | ✓             | ✓              | —             | —           |
  | Cola de Pagos          | ✓ (completo)  | ✓ (solo lect.) | ✓ (completo)  | —           |
  | Usuarios del Sistema   | ✓             | —              | —             | —           |

- **FR-002**: Para usuarios con múltiples roles, el menú DEBE mostrar la unión de secciones de todos sus roles. El nivel de acceso dentro de cada sección refleja el rol más permisivo que el usuario tenga para esa sección.
- **FR-003**: El indicador de sección activa en el menú DEBE actualizarse en tiempo real con cada cambio de sección.

**Protección de Rutas**

- **FR-004**: Toda ruta de la aplicación DEBE estar protegida mediante Next.js Middleware (`middleware.ts`) ejecutado en el edge, que verifica el JWT del cookie en cada request antes del render. El acceso sin sesión activa redirige al inicio de sesión, preservando la URL destino para redirigir tras el login exitoso.
- **FR-005**: El Middleware DEBE contener una tabla estática que mapea prefijos de ruta a los roles permitidos (e.g., `{ '/colaboradores': ['ADMINISTRADOR'] }`). El Middleware verifica que el rol del usuario esté en esa tabla antes de permitir el render. El acceso a una ruta restringida redirige al Inicio sin renderizar ningún contenido y sin mensaje de error técnico.
- **FR-006**: Al cargar la sesión, el cliente DEBE leer el campo `exp` del JWT, calcular `exp - now` y programar un `setTimeout` que redirige al inicio de sesión con un mensaje de sesión expirada cuando se cumpla el tiempo. La preservación de datos de formulario no guardados es responsabilidad de cada feature individual; esta spec no la garantiza.

**Experiencia de Navegación**

- **FR-007**: La sección mostrada por defecto tras un login exitoso DEBE ser siempre Inicio, independientemente del rol, a menos que exista una URL destino preservada del intento de acceso anterior.
- **FR-007B**: La sección Inicio DEBE mostrar una pantalla de bienvenida estática con el nombre del usuario y accesos directos (enlaces o tarjetas) a cada sección accesible para su rol. No muestra datos en tiempo real ni estadísticas de operación. Para el rol COLABORADOR, la pantalla muestra únicamente el mensaje de bienvenida sin accesos directos a otras secciones.
- **FR-008**: El menú de navegación DEBE ser accesible desde cualquier sección de la aplicación sin necesidad de volver a una página raíz. En pantallas pequeñas (mobile), el menú DEBE colapsar en un patrón hamburger/drawer; en desktop muestra el menú completo. El mismo componente sirve ambos formatos.
- **FR-009**: El sistema DEBE mostrar en la interfaz el nombre del usuario autenticado y sus roles activos en algún lugar visible (por ejemplo, encabezado o menú de perfil).
- **FR-010**: El usuario DEBE poder cerrar sesión desde cualquier sección de la aplicación (spec 005).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las rutas de secciones restringidas son inaccesibles para usuarios sin el rol requerido, incluso accediendo directamente por URL.
- **SC-002**: El 100% de los intentos de acceso sin sesión activa redirigen al inicio de sesión, sin exponer ningún contenido protegido.
- **SC-003**: Un usuario que inicia sesión puede llegar a su sección de trabajo en menos de 2 clics desde la pantalla de Inicio.
- **SC-004**: El menú de navegación muestra el indicador de sección activa correctamente en el 100% de las transiciones entre secciones.
- **SC-005**: Un usuario con múltiples roles ve en el menú la unión correcta de secciones sin necesidad de configuración adicional.

## Assumptions

- El menú de navegación principal es un componente persistente visible en todas las secciones de la aplicación (no reaparece solo en la pantalla de inicio).
- Los roles se leen de la sesión activa al momento del login. Los cambios de roles realizados mientras el usuario tiene sesión abierta tienen efecto en el siguiente login, no en la sesión actual.
- La URL destino preservada antes del login se almacena en la sesión del navegador (no en el servidor). Si el usuario cierra el navegador antes de hacer login, la URL destino se descarta.
- La sección "Cola de Pagos" para el rol SUPERVISOR es la misma vista de spec 007 con restricción de solo lectura; no es una vista separada.
- El rol COLABORADOR no tiene secciones de trabajo en el MVP. La pantalla de Inicio actúa como su destino final hasta que se definan funcionalidades específicas para ese rol en features futuras.
- Esta feature no define el diseño visual exacto del menú (colores, tipografía, iconos); eso es responsabilidad de la fase de implementación. La spec define el comportamiento, las reglas de acceso y el requisito de responsividad (hamburger/drawer en mobile, menú completo en desktop).
- La preservación del estado de una sección al volver a ella (filtros activos, scroll, etc.) está fuera del alcance de esta feature. Cada feature individual es responsable de gestionar su propio estado.
- Esta feature depende de spec 005 (login/logout) para la gestión de sesión y de spec 009 (creación de usuarios) para la asignación de roles.
