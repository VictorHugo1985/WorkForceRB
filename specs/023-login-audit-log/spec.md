# Feature Specification: Registro de Accesos (Login Audit Log)

**Feature Branch**: `023-login-audit-log`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "registrar los accesos a la aplicacion (los logeos) y poder acceder desde una opcion en el sidebar (solo opcion habilitada para el rol administrador)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver historial de accesos (Priority: P1)

Un administrador accede desde el sidebar a la sección "Accesos" y visualiza un listado cronológico de todos los inicios de sesión registrados en el sistema: quién ingresó, cuándo, desde qué IP y si el intento fue exitoso o fallido.

**Why this priority**: Es el núcleo de la funcionalidad. Sin este listado no hay forma de auditar quién accedió al sistema.

**Independent Test**: Puede probarse completamente iniciando sesión con un usuario, luego entrando a la vista de accesos como administrador y verificando que aparece el registro del ingreso reciente.

**Acceptance Scenarios**:

1. **Given** que soy administrador y existen accesos registrados, **When** abro "Accesos" en el sidebar, **Then** veo una tabla con columnas: usuario, fecha/hora, IP de origen, resultado (exitoso / fallido).
2. **Given** que soy administrador, **When** un usuario inicia sesión exitosamente, **Then** aparece un nuevo registro en el listado en tiempo real o al refrescar.
3. **Given** que soy administrador, **When** un usuario introduce credenciales incorrectas, **Then** aparece un registro con resultado "Fallido" y sin datos de usuario vinculado (si el email no existe) o con email intentado.
4. **Given** que soy usuario con rol distinto a ADMINISTRADOR, **When** intento acceder a la sección "Accesos", **Then** no veo la opción en el sidebar y cualquier acceso directo por URL es denegado.

---

### User Story 2 - Filtrar y buscar accesos (Priority: P2)

El administrador puede filtrar el historial por usuario, rango de fechas o resultado (exitoso/fallido) para encontrar eventos relevantes rápidamente.

**Why this priority**: Con volumen alto de accesos, navegar sin filtros se vuelve impráctico. Refuerza el valor de auditoría.

**Independent Test**: Puede probarse filtrando por usuario específico y verificando que solo aparecen sus accesos.

**Acceptance Scenarios**:

1. **Given** que estoy en la vista de accesos, **When** selecciono un usuario del filtro, **Then** la tabla muestra únicamente los accesos de ese usuario.
2. **Given** que estoy en la vista de accesos, **When** defino un rango de fechas, **Then** solo se muestran accesos dentro de ese intervalo.
3. **Given** que estoy en la vista de accesos, **When** filtro por resultado "Fallido", **Then** solo aparecen intentos de inicio de sesión no exitosos.

---

### Edge Cases

- ¿Qué se registra si el email ingresado no corresponde a ningún usuario? → Se registra el intento con el email como referencia, sin usuario vinculado y resultado "Fallido".
- ¿Cuántos registros se muestran por defecto? → Los 100 más recientes, con paginación para acceder a históricos anteriores.
- ¿Qué ocurre si el sistema no puede registrar el acceso (error de BD)? → El login no es bloqueado; el registro fallido se descarta silenciosamente (no afecta la autenticación).
- ¿Se registran los cierres de sesión? → No, solo los intentos de inicio de sesión (exitosos y fallidos).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE registrar automáticamente cada intento de inicio de sesión, exitoso o fallido, incluyendo: fecha/hora, email utilizado, usuario vinculado (si existe), IP de origen y resultado.
- **FR-002**: El sidebar DEBE mostrar la opción "Accesos" únicamente para usuarios con rol ADMINISTRADOR.
- **FR-003**: La opción "Accesos" en el sidebar DEBE estar completamente oculta para roles distintos a ADMINISTRADOR (no solo deshabilitada).
- **FR-004**: El acceso directo por URL a la sección de accesos DEBE ser denegado para usuarios sin rol ADMINISTRADOR.
- **FR-005**: La vista de accesos DEBE mostrar un listado paginado con al menos los campos: usuario (nombre o email), fecha/hora, IP de origen y resultado (Exitoso / Fallido).
- **FR-006**: El listado DEBE estar ordenado por fecha/hora descendente por defecto (más reciente primero).
- **FR-007**: El administrador DEBE poder filtrar los accesos por usuario, rango de fechas y resultado.
- **FR-008**: El registro de accesos NO DEBE interferir con el flujo de autenticación: un fallo al guardar el registro no debe impedir el login.

### Key Entities

- **Registro de Acceso**: Evento de intento de inicio de sesión. Atributos: fecha/hora, email intentado, usuario vinculado (opcional), IP de origen, resultado (exitoso/fallido).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los intentos de inicio de sesión (exitosos y fallidos) quedan registrados en el historial.
- **SC-002**: El administrador puede consultar el historial de accesos en menos de 3 segundos al abrir la sección.
- **SC-003**: Ningún usuario sin rol ADMINISTRADOR puede ver ni acceder a la sección de accesos, ni por sidebar ni por URL directa.
- **SC-004**: El administrador puede aplicar filtros y obtener resultados filtrados en menos de 2 segundos.

## Assumptions

- Los accesos se registran usando la infraestructura de auditoría existente (`registros_auditoria`) o una tabla dedicada; la decisión se toma en la fase de planificación.
- La IP de origen se obtiene de los headers de la petición HTTP; en entornos con proxy puede llegar como `x-forwarded-for`.
- No se requiere exportación del historial (PDF, CSV) en esta versión.
- No se requiere notificación en tiempo real de accesos sospechosos (fuera de alcance).
- Los cierres de sesión (logout) no se registran en esta fase.
- La retención de registros de acceso no tiene límite definido en esta versión; todos los registros se conservan.
