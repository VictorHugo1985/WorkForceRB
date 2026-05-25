# Feature Specification: Recepción en Tiempo Real de Registros de Asistencia

**Feature Branch**: `001-webhook-biometric-reception`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "Recepción en tiempo real de registros de asistencia — Como sistema de
integración, quiero recibir y persistir inmediatamente los eventos de marcaje biométrico enviados
por CrossChex Cloud vía webhook, para que el procesamiento posterior de asistencia disponga siempre
de datos completos y confiables."

## Clarifications

### Session 2026-05-25

- Q: ¿Cuál es la fuente correcta del ID único de idempotencia? → A: `records[].uuid` dentro del payload JSON (comportamiento real de CrossChex Cloud).
- Q: ¿Cómo debe almacenarse `checktime` en la base de datos? → A: Hora local Venezuela GMT-4 (UTC − 4h).
- Q: ¿Comportamiento ante falla de BD durante procesamiento del webhook? → A: Responder HTTP 200 de todas formas; el evento se pierde y se registra en log de error.
- Q: ¿Cómo manejar un `check_time` fuera de rango (futuro o >24h pasado)? → A: Persistir el evento sin importar el timestamp; registrar advertencia en log si está fuera de rango.
- Q: ¿El panel de administración para eventos "sin resolver" está en el alcance de esta feature? → A: No; esta spec cubre solo recepción y persistencia del webhook. El panel admin es una feature separada.

## User Scenarios & Testing

<!--
  User stories ordered by priority. Each story is independently testable
  and delivers value on its own.
-->

### User Story 1 - Recepción Exitosa de Marcaje (Priority: P1)

CrossChex Cloud envía un evento de marcaje biométrico al sistema. El sistema lo autentica, valida,
persiste de forma inmutable y confirma la recepción. El evento queda disponible para la vista de
asistencia en tiempo real en menos de 60 segundos.

**Why this priority**: Es el flujo fundamental del sistema. Sin él ningún cálculo de asistencia ni
vista en tiempo real es posible.

**Independent Test**: Enviar un webhook de prueba firmado al endpoint con datos de un colaborador
registrado y verificar que el evento aparece en la base de datos y en el dashboard dentro de
60 segundos.

**Acceptance Scenarios**:

1. **Given** CrossChex Cloud envía un evento válido con código de empleado registrado,
   **When** el sistema recibe el webhook autenticado,
   **Then** persiste el evento como registro inmutable y responde HTTP 200 en menos de 5 segundos.

2. **Given** el mismo evento ya fue recibido y persistido previamente (reintento de CrossChex),
   **When** CrossChex lo reenvía,
   **Then** el sistema responde HTTP 200 sin crear un registro duplicado.

3. **Given** el evento fue persistido correctamente,
   **When** han transcurrido menos de 60 segundos desde la recepción,
   **Then** el evento es visible en la vista de asistencia en tiempo real.

---

### User Story 2 - Rechazo de Solicitudes No Autorizadas (Priority: P2)

Cualquier solicitud al endpoint del webhook que no pueda ser autenticada como proveniente de
CrossChex Cloud es rechazada de inmediato sin persistir datos.

**Why this priority**: Protege la integridad del registro biométrico ante intentos de inyección de
datos no autorizados — principio crítico dado que los registros son append-only e inmutables.

**Independent Test**: Enviar solicitudes sin token, con token incorrecto y con payload manipulado,
y verificar que todas son rechazadas con HTTP 401 y ninguna persiste datos.

**Acceptance Scenarios**:

1. **Given** una solicitud sin cabecera de autenticación,
   **When** llega al endpoint del webhook,
   **Then** el sistema responde HTTP 401 y registra el intento en auditoría.

2. **Given** una solicitud con token de autenticación inválido,
   **When** llega al endpoint del webhook,
   **Then** el sistema responde HTTP 401 sin persistir ningún dato.

3. **Given** una solicitud con firma válida pero payload malformado o con campos obligatorios
   faltantes,
   **When** el sistema intenta procesar el evento,
   **Then** responde HTTP 200 con el body de confirmación esperado por CrossChex, registra el
   payload inválido completo en auditoría, y no lo incorpora al flujo de asistencia.

---

### User Story 3 - Preservación de Eventos con Código de Empleado Desconocido (Priority: P3)

CrossChex puede enviar marcajes de empleados cuyo código aún no haya sido registrado en el sistema.
El sistema preserva esos eventos sin pérdida, marcándolos como "sin resolver" para que el
administrador pueda asociarlos cuando corresponda.

**Why this priority**: Los relojes biométricos registran marcajes independientemente del estado del
sistema. Perder esos eventos violaría el principio de Inmutabilidad del Registro Biométrico.

**Independent Test**: Enviar un evento con código de empleado no registrado y verificar que se
almacena con estado "sin resolver" y es visible para el administrador.

**Acceptance Scenarios**:

1. **Given** CrossChex envía un evento con código de empleado no registrado en el sistema,
   **When** el sistema recibe el webhook autenticado,
   **Then** persiste el evento con estado "sin resolver" y responde HTTP 200.

2. **Given** existen eventos con estado "sin resolver",
   **When** un administrador accede al panel de gestión de eventos,
   **Then** puede visualizar la lista de eventos pendientes de asociación con su detalle completo.
   *(Nota: este escenario está fuera del alcance de esta feature. La visualización y gestión
   de eventos "sin resolver" corresponde a una feature administrativa separada.)*

---

### Edge Cases

- ¿Qué ocurre si CrossChex envía un payload con campos obligatorios faltantes o tipos incorrectos?
- Si la base de datos no está disponible al momento de la recepción, el sistema responde
  HTTP 200 a CrossChex para evitar reintentos en cascada; el evento se pierde y el error
  queda registrado en el log de aplicación. Pérdida aceptada para el MVP.
- ¿Qué sucede si llegan múltiples eventos idénticos en ráfaga (duplicados en milisegundos)?
- Eventos con `check_time` en el futuro o más de 24 horas en el pasado se persisten sin
  rechazo; el sistema registra una advertencia en el log de aplicación para trazabilidad.
  No se bloquea la recepción por timestamp sospechoso.
- ¿Qué ocurre si el volumen de eventos supera la capacidad de procesamiento síncrono?

## Requirements

### Functional Requirements

- **FR-001**: El sistema DEBE exponer un endpoint HTTPS dedicado para recibir eventos de
  CrossChex Cloud.
- **FR-002**: El sistema DEBE autenticar cada solicitud entrante validando la firma digital
  (`authorize-sign`) incluida en los headers de la petición contra el secreto configurado
  por el administrador.
- **FR-003**: El sistema DEBE validar el formato y los campos obligatorios del payload de
  CrossChex antes de persistir el evento.
- **FR-004**: El sistema DEBE persistir cada evento biométrico válido como registro de solo
  escritura (append-only), sin posibilidad de modificación posterior directa.
- **FR-005**: El sistema DEBE responder a CrossChex en menos de 5 segundos para el 99% de las
  solicitudes, a fin de evitar reintentos innecesarios.
- **FR-006**: El sistema DEBE detectar y manejar eventos duplicados de forma idempotente
  usando el campo `uuid` incluido en cada elemento del array `records[]` del payload JSON,
  respondiendo HTTP 200 sin crear registros extra. El header HTTP `requestid` no es utilizado
  como clave de idempotencia (CrossChex Cloud no lo envía de forma consistente).
- **FR-007**: El sistema DEBE almacenar eventos con código de empleado no registrado con estado
  "sin resolver", sin rechazarlos.
- **FR-008**: El sistema DEBE registrar en el log de auditoría todo intento de acceso no
  autorizado al endpoint, incluyendo IP de origen y timestamp.
- **FR-009**: El evento persistido DEBE estar disponible para la vista de asistencia en tiempo
  real en un máximo de 60 segundos desde su recepción.
- **FR-010**: El sistema DEBE permitir al administrador configurar y rotar el token secreto del
  webhook sin interrumpir la recepción de eventos.
- **FR-011**: El sistema DEBE aceptar eventos aunque el reloj biométrico origen no esté
  previamente registrado, marcando el evento con estado de dispositivo "desconocido".
- **FR-012**: El sistema DEBE responder a CrossChex con el body de confirmación exacto que
  el protocolo requiere para que CrossChex dé el evento por entregado correctamente.
- **FR-013**: El sistema DEBE siempre responder HTTP 200 ante cualquier evento con firma
  válida (incluyendo payloads malformados), a fin de evitar que CrossChex realice reintentos
  innecesarios; los errores de payload se registran internamente sin afectar la respuesta.

**Fuera del alcance de esta feature**: la visualización y gestión administrativa de eventos
con estado "sin resolver" o "dispositivo desconocido" es una feature separada. Esta spec cubre
exclusivamente la recepción, autenticación y persistencia del webhook.

### Key Entities

- **EventoBiométrico**: Registro de marcaje recibido de CrossChex. Atributos clave:
  `uuid` (UUID único por evento dentro de `records[]`, usado como clave de idempotencia),
  `check_time` (timestamp ISO 8601 del marcaje en el dispositivo, enviado en UTC por CrossChex
  y convertido a hora local Venezuela GMT-4 antes de persistir),
  `check_type` (entero: 0 = entrada, 1 = salida),
  `device.serial_number` (número de serie del reloj biométrico),
  `device.name` (nombre del dispositivo),
  `employee.workno` (código del empleado en CrossChex),
  `employee.first_name` y `employee.last_name` (nombre del empleado según CrossChex),
  estado de resolución (resuelto / sin resolver / dispositivo desconocido),
  timestamp de recepción por el sistema, payload original completo.
  **Nota de estructura**: CrossChex Cloud envuelve los eventos en un array `records[]` dentro
  del body JSON; cada petición puede contener uno o más eventos.
- **DispositivoBiométrico**: Reloj CrossChex registrado en el sistema. Atributos: identificador,
  número de serie (`serial_number`), nombre descriptivo. El secreto de autenticación del webhook
  es una configuración global del canal webhook (no un atributo por dispositivo).
- **Colaborador**: Persona registrada en el sistema con su código correspondiente en CrossChex,
  usado para la asociación de eventos recibidos.

## Success Criteria

### Measurable Outcomes

- **SC-001**: El 100% de los eventos válidos enviados por CrossChex se persisten en el sistema
  sin pérdida.
- **SC-002**: El 99% de las solicitudes webhook reciben respuesta en menos de 5 segundos.
- **SC-003**: Los eventos válidos están disponibles en el dashboard de asistencia en menos de
  60 segundos desde su recepción.
- **SC-004**: El 100% de los eventos duplicados son descartados idempotentemente sin crear
  registros extra.
- **SC-005**: El 0% de las solicitudes no autorizadas resulta en persistencia de datos.
- **SC-006**: El 100% de los eventos con código de empleado desconocido se preservan con estado
  "sin resolver".
- **SC-007**: El sistema mantiene la recepción de eventos ante picos de hasta 50 marcajes
  simultáneos sin pérdida.

## Assumptions

- CrossChex Cloud envía eventos mediante HTTP POST con payload JSON envuelto en `records[]`.
- CrossChex Cloud envía `check_time` en UTC. El sistema lo convierte a hora local Venezuela
  (GMT-4, UTC − 4h) antes de persistirlo. Todos los timestamps almacenados en
  `eventos_biometricos_desglosados.checktime` reflejan hora local venezolana.
- CrossChex incluye el token secreto en una cabecera HTTP de cada solicitud para autenticación.
- CrossChex reintenta la entrega exactamente **2 veces en 1 minuto** si recibe respuesta no-2xx;
  por ello el sistema responde siempre HTTP 200 ante cualquier evento firmado válidamente
  (incluyendo duplicados y payloads malformados) para evitar reintentos.
- El volumen estimado en hora pico es de hasta 50 marcajes simultáneos (entrada/salida de turno).
- El reloj CrossChex Cloud es el único dispositivo en el alcance del MVP para integración vía
  webhook; otros dispositivos utilizan importación CSV.
- El formato del payload de CrossChex Cloud sigue la especificación oficial de su API de webhooks;
  los campos exactos se documentarán en la fase de planificación tras revisar la documentación
  del fabricante.
- Un "evento duplicado" se identifica por el campo `uuid` dentro de cada elemento de
  `records[]` en el payload JSON. CrossChex Cloud no envía un `requestId` único en los headers
  HTTP de forma consistente; el UUID de idempotencia está en el payload.
- La integración vía webhooks requiere que Anviz active el **Developer Mode** en la cuenta de
  CrossChex Cloud; este proceso es manual y tarda 1-2 días hábiles (solicitado en
  community.anviz.com indicando el Company ID). Es un prerrequisito externo bloqueante.
