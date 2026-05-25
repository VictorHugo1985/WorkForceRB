# Feature Specification: Autenticación de Usuarios (Login / Logout)

**Feature Branch**: `005-user-login`

**Created**: 2026-05-22

**Status**: Draft

## Clarifications

### Session 2026-05-22

- Q: ¿La sesión debe sobrevivir al cierre del navegador o expirar automáticamente con él? → A: La sesión expira al cerrar el navegador (cookie de sesión, sin persistencia). El usuario debe re-autenticarse en cada sesión de navegador nueva.
- Q: ¿Cuántos intentos fallidos consecutivos activan el bloqueo temporal y cuánto dura? → A: 5 intentos fallidos consecutivos activan un bloqueo de 15 minutos para ese correo.
- Q: ¿Esta feature incluye definir las reglas de acceso por rol (RBAC), o solo el mecanismo de autenticación? → A: Solo autenticación y redirección inicial. Las reglas de qué rutas/secciones accede cada rol se definen en cada feature específica o en una feature RBAC separada.

### Session 2026-05-23

- Q: ¿El login debe detectar y manejar el flujo de primer acceso con contraseña inicial (spec 009)? → A: Sí. Tras autenticarse con credenciales válidas, si el usuario tiene `debe_cambiar_password = true`, el sistema redirige al flujo de cambio de contraseña antes de dar acceso al dashboard. El acceso al dashboard solo se otorga tras completar el cambio.
- Q: ¿La feature cubre solo ADMINISTRADOR y SUPERVISOR, o los 4 roles del sistema (constitución v1.1.0)? → A: Los 4 roles (ADMINISTRADOR, SUPERVISOR, CAJERO, COLABORADOR) se autentican con el mismo mecanismo. No hay distinción en el flujo de login por rol.
- Q: ¿Cuál es el tiempo de inactividad por defecto para la expiración de sesión? → A: 2 horas.

### Session 2026-05-25

- Q: ¿Cómo se detecta que una cuenta fue desactivada durante una sesión JWT activa? → A: El `JwtStrategy` consulta `usuarios.activo` en DB en cada request autenticado. Si `activo = false`, retorna 401 inmediatamente (equivalente a jti revocado). Overhead aceptable para MVP (~10 usuarios).
- Q: ¿Qué retorna `POST /auth/login` para guiar la redirección post-login por rol? → A: El response body es `{ nombre, roles, debeChangiarPassword }`. El backend no calcula ni retorna URLs de redirect. El frontend (con la lógica de spec 010) decide la URL destino basándose en el array `roles`. El token JWT viaja en la cookie HttpOnly, no en el body.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inicio de Sesión con Credenciales Válidas (Priority: P1)

Como usuario del sistema (Administrador, Supervisor, Cajero o Colaborador), quiero iniciar
sesión con mi correo electrónico y contraseña para acceder a las funcionalidades que
corresponden a mi rol.

**Why this priority**: La autenticación es el control de acceso fundamental. Ninguna
funcionalidad operativa puede utilizarse sin identificar al usuario y validar sus permisos.

**Independent Test**: Con credenciales válidas de cada uno de los cuatro roles (ADMINISTRADOR,
SUPERVISOR, CAJERO, COLABORADOR), verificar que el login concede acceso y redirige al dashboard
correspondiente. Con credenciales incorrectas, verificar que el acceso es denegado con mensaje
claro.

**Acceptance Scenarios**:

1. **Given** un usuario registrado con correo y contraseña válidos,
   **When** ingresa sus credenciales correctas,
   **Then** el sistema le otorga acceso y redirige a su dashboard inicial según su rol.

2. **Given** credenciales incorrectas (correo o contraseña erróneos),
   **When** el usuario intenta iniciar sesión,
   **Then** el sistema deniega el acceso y muestra un mensaje de error genérico sin revelar
   si fue el correo o la contraseña el incorrecto.

3. **Given** un usuario con cuenta desactivada,
   **When** intenta iniciar sesión con credenciales técnicamente válidas,
   **Then** el sistema deniega el acceso con un mensaje que indica que la cuenta está inactiva.

4. **Given** un usuario autenticado que intenta acceder a una URL protegida,
   **When** su sesión está activa,
   **Then** accede directamente sin necesidad de re-autenticarse.

5. **Given** un usuario cuya cuenta fue creada con una contraseña inicial (spec 009) y aún no la cambió (`debe_cambiar_password = true`),
   **When** inicia sesión con sus credenciales válidas,
   **Then** el sistema no da acceso al dashboard; en su lugar redirige al flujo de cambio de contraseña obligatorio. Solo tras completar el cambio se otorga acceso al dashboard correspondiente a su rol.

---

### User Story 2 - Cierre de Sesión Seguro (Priority: P2)

Como usuario autenticado, quiero cerrar sesión de forma explícita para asegurarme de que
nadie más pueda acceder al sistema en mi nombre desde el mismo dispositivo.

**Why this priority**: Sin logout, una sesión activa queda expuesta si el usuario se aleja
del equipo. Es un requisito mínimo de seguridad operativa.

**Independent Test**: Tras hacer logout, intentar acceder a cualquier página protegida redirige
al login; la sesión previa no puede reutilizarse.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado,
   **When** ejecuta la acción de cerrar sesión,
   **Then** la sesión queda invalidada y el usuario es redirigido a la página de login.

2. **Given** un usuario que acaba de cerrar sesión,
   **When** intenta acceder a una página protegida (usando el botón Atrás del navegador),
   **Then** el sistema redirige al login y no muestra contenido protegido.

---

### User Story 3 - Protección de Rutas No Autenticadas (Priority: P3)

Un usuario no autenticado que intenta acceder directamente a una URL protegida es
redirigido al login y, tras autenticarse correctamente, regresa a la URL que intentaba visitar.

**Why this priority**: Sin esta protección, las rutas del sistema quedan expuestas. La
redirección post-login mejora la experiencia sin comprometer la seguridad.

**Independent Test**: Acceder a una URL protegida sin sesión activa redirige al login;
tras autenticarse, el usuario llega a la URL originalmente solicitada.

**Acceptance Scenarios**:

1. **Given** un usuario sin sesión activa,
   **When** intenta acceder directamente a una URL protegida,
   **Then** es redirigido al login.

2. **Given** un usuario redirigido al login desde una URL protegida,
   **When** se autentica correctamente,
   **Then** es redirigido a la URL que intentaba visitar originalmente.

---

### Edge Cases

- ¿Qué ocurre si el usuario envía el formulario de login repetidamente con credenciales incorrectas? → El sistema limita los intentos fallidos (protección contra fuerza bruta) y bloquea temporalmente el acceso tras superar el umbral.
- ¿Qué pasa si la sesión expira mientras el usuario está navegando? → Al intentar cualquier acción protegida, el sistema redirige al login con un mensaje de sesión expirada.
- ¿Qué ocurre si el usuario deja el navegador abierto sin actividad por un período prolongado? → La sesión expira automáticamente tras un período de inactividad configurable.
- ¿Puede el mismo usuario tener múltiples sesiones simultáneas (diferentes dispositivos o navegadores)? → Sí; para el MVP se permiten sesiones concurrentes sin restricción de dispositivo único.
- ¿Qué pasa si el administrador desactiva una cuenta mientras el usuario tiene sesión activa? → El `JwtStrategy` consulta `activo` en DB en cada request; el primer request posterior a la desactivación retorna 401 y el frontend redirige al login con mensaje "cuenta inactiva". La sesión se invalida de forma inmediata en el siguiente request del usuario.
- ¿Qué pasa si el usuario cierra el navegador mientras está en el flujo de cambio de contraseña obligatorio? → La sesión expira normalmente (cookie de sesión). Al volver a autenticarse, el sistema detecta nuevamente `debe_cambiar_password = true` y repite la redirección al flujo de cambio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE requerir correo electrónico y contraseña para autenticar a cualquier usuario.
- **FR-002**: El sistema DEBE validar que el correo existe y que la contraseña corresponde al hash almacenado para ese usuario.
- **FR-003**: El sistema DEBE rechazar el acceso a usuarios con cuenta desactivada (`activo = false`), incluso si la contraseña es correcta. Adicionalmente, el `JwtStrategy` DEBE verificar `activo` en DB en cada request autenticado: si `activo = false`, retorna 401 inmediatamente y la sesión queda invalidada de facto en el siguiente request del usuario afectado.
- **FR-004**: El sistema DEBE mostrar un único mensaje de error genérico ante credenciales inválidas, sin revelar cuál de los dos campos es incorrecto (correo o contraseña).
- **FR-005**: Tras un login exitoso con `debe_cambiar_password = false`, el backend retorna `{ nombre, roles[], debeChangiarPassword: false }` en el response body (el JWT viaja en la cookie HttpOnly). El frontend usa el array `roles` para determinar la URL de destino según la lógica de spec 010. El backend no calcula ni retorna URLs de redirect.
- **FR-012**: Si tras autenticarse el usuario tiene `debe_cambiar_password = true`, el sistema DEBE redirigir al flujo de cambio de contraseña obligatorio en lugar del dashboard. La sesión queda en estado restringido: solo el flujo de cambio de contraseña es accesible hasta que se complete. Tras el cambio exitoso, el sistema redirige al dashboard según rol y marca `debe_cambiar_password = false`.
- **FR-006**: El sistema DEBE permitir al usuario cerrar sesión explícitamente desde cualquier página del sistema; tras el logout, la sesión queda invalidada de forma inmediata.
- **FR-007**: El sistema DEBE redirigir automáticamente al login a cualquier usuario no autenticado que intente acceder a una URL protegida, y redirigirlo a esa URL tras autenticarse.
- **FR-008**: La sesión activa es una cookie de sesión (no persistente): expira automáticamente al cerrar el navegador. Adicionalmente, expira por inactividad tras 2 horas sin actividad mientras el navegador permanece abierto (valor por defecto configurable). En ambos casos, el usuario es redirigido al login con un mensaje indicando el motivo (sesión cerrada / sesión expirada por inactividad).
- **FR-009**: El sistema DEBE bloquear temporalmente el acceso de un correo tras 5 intentos de login fallidos consecutivos. El bloqueo dura 15 minutos, tras los cuales el contador se reinicia. Durante el bloqueo, el sistema informa al usuario del tiempo restante.
- **FR-010**: Todo intento de login (exitoso o fallido) DEBE quedar registrado en el log de auditoría: correo intentado, resultado (éxito/fallo), timestamp e IP de origen.
- **FR-011**: El sistema DEBE actualizar el campo `ultimo_acceso` del usuario al completar un login exitoso.

### Key Entities

- **Sesión de Usuario**: Período de acceso autenticado tras un login exitoso. Tiene una duración definida por inactividad y se invalida explícitamente con el logout.
- **Credenciales**: Correo electrónico + contraseña del usuario. La contraseña se almacena como hash; nunca se persiste ni transmite en texto plano.
- **Registro de Auditoría de Acceso**: Traza inmutable de cada intento de login (exitoso o fallido), con timestamp, IP y resultado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los usuarios con credenciales válidas y cuenta activa logran iniciar sesión en menos de 3 segundos desde el envío del formulario.
- **SC-002**: El 100% de los intentos de acceso con credenciales inválidas reciben un mensaje de error genérico que no revela el campo incorrecto.
- **SC-003**: El 100% de los intentos de login (exitosos y fallidos) quedan registrados en el log de auditoría.
- **SC-004**: Tras el logout, el 100% de los intentos de reacceso usando la sesión invalidada son bloqueados y redirigidos al login.
- **SC-005**: El 100% de las rutas protegidas redirigen al login cuando el usuario no tiene sesión activa.

## Assumptions

- La constitución v1.1.0 (spec 009) define cuatro roles de sistema: `ADMINISTRADOR`, `SUPERVISOR`, `CAJERO` y `COLABORADOR`. Esta feature cubre el login de usuarios con cualquiera de los cuatro roles; el mecanismo de autenticación es idéntico para todos. Las funcionalidades accesibles por cada rol se definen en sus features específicas.
- Las contraseñas son gestionadas con hash seguro; la feature de creación de usuarios (con asignación de contraseña inicial) es una feature separada (spec 009). Spec 005 no crea contraseñas ni usuarios, pero sí detecta el estado `debe_cambiar_password = true` y gestiona la redirección obligatoria al cambio (FR-012). El formulario de cambio de contraseña en sí puede pertenecer a spec 009 o a una feature de perfil de usuario.
- La recuperación de contraseña olvidada está fuera del alcance de esta feature; es una feature posterior.
- La sesión es una cookie de sesión (no persistente): no sobrevive al cierre del navegador. No existe opción "Recordarme". Esta decisión se tomó por seguridad dado el entorno de equipos compartidos en la imprenta.
- Se permiten múltiples sesiones simultáneas para un mismo usuario (diferentes dispositivos) en el MVP.
- La duración del período de inactividad para expiración de sesión es un parámetro configurable. El valor por defecto es 2 horas, elegido para cubrir un turno de trabajo completo sin interrupciones innecesarias.
- El umbral de bloqueo por intentos fallidos es 5 intentos / 15 minutos (fijo para el MVP).
- Esta feature no incluye autenticación multifactor (MFA); es una mejora futura.
- Las reglas de autorización por rol (qué rutas y secciones puede acceder ADMINISTRADOR vs SUPERVISOR) están fuera del alcance de esta feature; cada feature posterior define su propio control de acceso, o se unifica en una feature RBAC dedicada.
