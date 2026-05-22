# Feature Specification: Creación y Gestión de Cuentas de Usuario del Sistema

**Feature Branch**: `009-create-system-user`

**Created**: 2026-05-22

**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear Cuenta de Acceso con Rol(es) (Priority: P1)

El administrador crea una nueva cuenta de acceso para un integrante del equipo: asigna
su nombre, correo electrónico, uno o más roles del sistema y define una contraseña inicial.
La cuenta queda activa y lista para el primer inicio de sesión.

**Why this priority**: Sin una cuenta de usuario, ningún integrante del equipo puede
acceder al sistema. Esta es la puerta de entrada a todas las demás funcionalidades.

**Independent Test**: El administrador crea una cuenta para "María González" con correo
maria@empresa.com, roles SUPERVISOR y CAJERO, y contraseña inicial. María puede iniciar
sesión inmediatamente con esas credenciales.

**Acceptance Scenarios**:

1. **Given** el administrador accede a la gestión de cuentas de usuario,
   **When** ingresa nombre completo, correo electrónico, selecciona uno o más roles y
   establece una contraseña inicial,
   **Then** la cuenta queda creada y activa; el usuario puede iniciar sesión con esas
   credenciales.

2. **Given** el administrador está creando una nueva cuenta,
   **When** selecciona más de un rol para el mismo usuario (por ejemplo, SUPERVISOR y
   CAJERO),
   **Then** el sistema acepta la combinación sin restricciones; el usuario opera con los
   permisos de todos sus roles asignados.

3. **Given** el administrador intenta crear una cuenta con un correo electrónico que ya
   existe en el sistema,
   **When** intenta confirmar,
   **Then** el sistema rechaza la operación con un mensaje que indica que el correo ya
   está registrado. No se crea una cuenta duplicada.

4. **Given** el administrador intenta crear una cuenta sin seleccionar al menos un rol,
   **When** intenta confirmar,
   **Then** el sistema rechaza la operación indicando que el rol es obligatorio.

5. **Given** el administrador define la contraseña inicial,
   **When** la contraseña no cumple la política mínima de seguridad,
   **Then** el sistema rechaza la operación e informa los requisitos de contraseña.

---

### User Story 2 - Vincular Cuenta a Registro de Colaborador (Priority: P2)

Al crear la cuenta, el administrador puede vincularla al registro de colaborador
(empleado) correspondiente en la base de datos de personal. Esta vinculación permite
que el sistema relacione las acciones del usuario con el perfil del empleado.

**Why this priority**: Los supervisores y otros usuarios que también son empleados
necesitan que sus cuentas de sistema estén vinculadas a sus fichas de personal para
que el sistema pueda aplicar correctamente las reglas de asignación (por ejemplo, que
el supervisor solo vea a sus colaboradores asignados).

**Independent Test**: El administrador crea la cuenta de Carlos Méndez con rol
SUPERVISOR y la vincula a su ficha en la base de personal. Al iniciar sesión, Carlos
solo ve a los colaboradores asignados a él.

**Acceptance Scenarios**:

1. **Given** el administrador está creando una cuenta para alguien que ya existe como
   colaborador en el sistema,
   **When** busca y selecciona el registro del colaborador para vincularlo,
   **Then** la cuenta de usuario queda asociada al registro del empleado; las acciones
   del usuario en el sistema quedan trazadas a esa persona.

2. **Given** el administrador está creando una cuenta para un usuario administrativo
   que no tiene ficha de empleado (e.g., un administrador externo),
   **When** deja el campo de vinculación de colaborador vacío,
   **Then** la cuenta se crea normalmente sin vínculo a ningún colaborador; el campo
   es opcional.

3. **Given** una cuenta de usuario ya vinculada a un colaborador,
   **When** el administrador necesita cambiar el vínculo o eliminar la asociación,
   **Then** el sistema permite modificar o deshacer la vinculación desde la edición
   de la cuenta.

---

### User Story 3 - Gestionar Cuentas Existentes (Priority: P3)

El administrador puede consultar la lista de cuentas de usuario, editar roles o datos
de una cuenta existente, y desactivar una cuenta cuando un integrante deja el equipo.

**Why this priority**: Las necesidades del equipo cambian: personas cambian de rol,
salen de la organización o requieren ajustes de acceso. La gestión de cuentas existentes
mantiene el sistema seguro y actualizado.

**Independent Test**: El administrador desactiva la cuenta de un empleado que salió.
El empleado ya no puede iniciar sesión. La cuenta y su historial permanecen en el
sistema para fines de auditoría.

**Acceptance Scenarios**:

1. **Given** el administrador accede al listado de cuentas de usuario,
   **When** visualiza la lista,
   **Then** el sistema muestra todas las cuentas con: nombre, correo, roles asignados,
   estado (activa / inactiva) y fecha de creación.

2. **Given** una cuenta de usuario activa,
   **When** el administrador edita sus roles asignados,
   **Then** los cambios de rol tienen efecto en el próximo inicio de sesión del
   usuario (o en la sesión activa, si ya hay una abierta).

3. **Given** un integrante deja la organización,
   **When** el administrador desactiva su cuenta,
   **Then** el usuario no puede iniciar sesión ni retomar ninguna sesión activa.
   La cuenta y su historial de acciones permanecen en el sistema para auditoría;
   la cuenta no se elimina.

4. **Given** el administrador desea buscar una cuenta específica,
   **When** escribe el nombre o correo del usuario en el buscador,
   **Then** la lista se filtra mostrando solo las cuentas que coinciden.

---

### Edge Cases

- ¿Puede el administrador eliminar permanentemente una cuenta? → No; las cuentas solo se desactivan. Eliminarlas rompería la trazabilidad del log de auditoría. La desactivación es la única operación de baja disponible.
- ¿Puede un administrador modificar su propia cuenta? → Puede cambiar su nombre. No puede quitarse a sí mismo el rol ADMINISTRADOR si es la única cuenta con ese rol activo, para evitar quedar sin administrador en el sistema.
- ¿Qué pasa si una cuenta desactivada tiene sesión abierta en ese momento? → La sesión se invalida inmediatamente; el usuario es desconectado en su próxima acción en el sistema.
- ¿Puede el mismo correo electrónico usarse en más de una cuenta? → No; el correo es el identificador único de la cuenta y el sistema rechaza duplicados.
- ¿El administrador puede ver o cambiar contraseñas de otros usuarios? → No puede ver contraseñas (nunca se muestran en texto claro). Puede generar una nueva contraseña temporal para otro usuario si este la olvida (operación distinta a la creación inicial).
- ¿Qué combinaciones de roles son válidas? → Todas; no hay restricciones en la combinación de roles. Un usuario puede tener todos los roles simultáneamente si el negocio lo requiere.
- ¿Qué pasa si se intenta vincular una ficha de colaborador que ya está vinculada a otra cuenta? → El sistema rechaza el vínculo duplicado; cada ficha de colaborador puede estar vinculada a una sola cuenta de sistema.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo el ADMINISTRADOR puede crear, editar y desactivar cuentas de usuario del sistema.
- **FR-002**: El sistema DEBE permitir crear una cuenta con los campos obligatorios: nombre completo, correo electrónico (único en el sistema) y al menos un rol asignado.
- **FR-003**: Los roles disponibles son: ADMINISTRADOR, SUPERVISOR, CAJERO y COLABORADOR. Un usuario puede tener cualquier combinación de roles sin restricciones.
- **FR-004**: El administrador DEBE definir una contraseña inicial al crear la cuenta. La contraseña debe cumplir la política de seguridad del sistema (mínimo 8 caracteres, al menos una letra mayúscula, una minúscula y un número). El sistema almacena la contraseña de forma segura; nunca se guarda ni muestra en texto claro.
- **FR-005**: La cuenta recién creada DEBE requerir que el usuario cambie su contraseña en el primer inicio de sesión. La contraseña inicial es de un solo uso.
- **FR-006**: El administrador PUEDE vincular la cuenta al registro de un colaborador (empleado) existente en la base de personal. La vinculación es opcional. Cada ficha de colaborador puede estar vinculada a una sola cuenta de usuario.
- **FR-007**: El administrador DEBE poder editar los roles asignados y el nombre de una cuenta existente. El correo electrónico no puede modificarse una vez creada la cuenta.
- **FR-008**: El administrador DEBE poder desactivar una cuenta. Una cuenta desactivada no puede iniciar sesión y cualquier sesión activa se invalida. Las cuentas no pueden eliminarse permanentemente.
- **FR-009**: El sistema DEBE rechazar la desactivación de la última cuenta con rol ADMINISTRADOR activo, para garantizar que siempre haya al menos un administrador operativo.
- **FR-010**: El sistema DEBE mostrar la lista de cuentas con: nombre, correo, roles, estado (activa / inactiva) y fecha de creación. La lista debe ser filtrable por nombre o correo.
- **FR-011**: Toda creación, edición de roles y desactivación de cuenta DEBE quedar registrada en el log de auditoría con el usuario que realizó la acción y el timestamp.

### Key Entities

- **Cuenta de Usuario del Sistema**: Credenciales de acceso al sistema (correo + contraseña) con uno o más roles asignados. Puede estar vinculada opcionalmente a un registro de colaborador. Tiene estado activa / inactiva.
- **Rol de Usuario**: Permiso funcional que define qué puede hacer el usuario en el sistema. Valores: ADMINISTRADOR, SUPERVISOR, CAJERO, COLABORADOR. Un usuario puede acumular múltiples roles.
- **Vínculo a Colaborador**: Asociación opcional entre una cuenta de sistema y un registro de empleado (Colaborador). Permite trazar acciones del usuario a su perfil de personal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede crear una cuenta de usuario completa (con rol y contraseña) en menos de 2 minutos.
- **SC-002**: El 100% de los correos electrónicos son únicos en el sistema; el sistema rechaza el 100% de los intentos de crear cuentas con correos duplicados.
- **SC-003**: El 100% de las cuentas desactivadas son bloqueadas inmediatamente; el usuario no puede iniciar sesión ni mantener sesiones activas tras la desactivación.
- **SC-004**: El sistema garantiza que siempre exista al menos una cuenta con rol ADMINISTRADOR activo; rechaza el 100% de los intentos de desactivar la última cuenta de administrador.
- **SC-005**: El 100% de las creaciones, ediciones de rol y desactivaciones quedan en el log de auditoría con usuario y timestamp.

## Assumptions

- Solo el ADMINISTRADOR gestiona cuentas de usuario. Ningún otro rol tiene acceso a la administración de cuentas.
- **Enmienda al modelo de datos requerida (spec 003)**: Esta feature requiere dos cambios en el modelo de datos aprobado:
  1. Agregar los valores `CAJERO` y `COLABORADOR` al enum `RolUsuario` (actualmente solo tiene ADMINISTRADOR y SUPERVISOR).
  2. Cambiar la relación de rol a muchos-a-muchos: el campo `rol` único en `UsuarioSistema` debe reemplazarse por una tabla intermedia `usuario_roles` que permita múltiples roles por usuario. Esta enmienda afecta también la lógica de verificación de rol en spec 005 (login).
- **Enmienda a spec 007**: La assumption de spec 007 que establecía "CAJERO = ADMINISTRADOR en el MVP" queda reemplazada por esta feature, que introduce el rol CAJERO como un rol técnico distinto en el sistema.
- El correo electrónico es el identificador único e inmutable de la cuenta de usuario. Una vez creada la cuenta, el correo no puede cambiarse.
- La política de contraseña (mínimo 8 caracteres, mayúscula, minúscula, número) es un valor razonable basado en NIST SP 800-63B. Puede ajustarse en la fase de planificación.
- La contraseña inicial es de un solo uso. El sistema fuerza el cambio en el primer inicio de sesión (spec 005 gestiona el flujo de login; esta feature solo establece el flag de "cambio requerido").
- La vinculación cuenta↔colaborador es una referencia a la entidad `Colaborador` del modelo de datos (spec 003, spec 004). No crea ni modifica el registro del colaborador; solo establece el vínculo.
- La creación de cuentas para roles `COLABORADOR` sirve como base para futuros accesos de empleados al sistema (consulta de recibos, etc.). En el MVP, las capacidades del rol COLABORADOR pueden ser mínimas y definirse en una feature posterior.
- Esta feature no incluye recuperación de contraseña por correo electrónico (reset link). Esa funcionalidad es una feature futura.
