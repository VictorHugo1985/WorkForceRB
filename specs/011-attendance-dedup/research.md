# Research: Control de Eventos Biométricos Duplicados

**Feature**: 011-attendance-dedup | **Date**: 2026-05-22

---

## Decision 1: Punto de integración en el pipeline de procesamiento (spec 001)

**Decision**: El `DeduplicationService` se invoca inmediatamente después de que el evento biométrico es resuelto (colaborador_id asignado) y ANTES de que se dispare el cálculo de liquidación. Es el último paso de "calificación" del evento antes de que entre al flujo de horas.

**Rationale**: La deduplicación solo tiene sentido sobre eventos resueltos (RESUELTO); no hay que detectar duplicados de eventos sin colaborador asignado. El check debe ocurrir antes del trigger de cálculo para que el cálculo nunca vea el evento como PROCESADO si es un duplicado.

**Alternatives considered**:
- Job batch asíncrono: rechazado porque el pipeline de spec 001 es síncrono/reactivo (Principio X), y detectar el duplicado en batch significa que el evento aparece en cálculos antes de ser flaggeado.
- Pre-persistencia: rechazado porque el evento debe existir en DB primero para poder persistirlo (append-only), y la detección requiere consultar eventos previos ya persistidos.

---

## Decision 2: Campo tipo_evento (ENTRADA/SALIDA) en EventoBiometricoDesglosado

**Decision**: Agregar campo `tipo_evento` (enum `TipoEvento: ENTRADA, SALIDA, DESCONOCIDO`) a `eventos_biometricos_desglosados`. El valor se extrae del campo `io` del payload CrossChex (0 = ENTRADA, 1 = SALIDA). Para dispositivos CSV sin campo `io`, se usa `DESCONOCIDO`.

**Rationale**: La detección de duplicados (FR-002) requiere verificar "mismo tipo de evento (ENTRADA o SALIDA)". Este campo no existe en el modelo actual de spec 003; es una enmienda necesaria adicional al modelo. Sin él, la deduplicación solo se puede aplicar entre todos los eventos del colaborador sin distinguir dirección, lo cual generaría falsos positivos.

**Alternatives considered**:
- Extraer del payload_completo en runtime: rechazado porque hace la consulta de deduplicación no indexable y añade lógica de parsing al servicio de deduplicación (violación de SRP).
- Inferir por par entrada/salida: rechazado como alternativa — CrossChex siempre envía el campo `io` cuando está disponible.

---

## Decision 3: Extensión de EstadoResolucion vs. campo separado

**Decision**: Extender el enum `EstadoResolucion` con dos nuevos valores: `POTENCIAL_DUPLICADO` y `DUPLICADO`. El estado `RESUELTO` continúa representando eventos válidos e incluidos en cálculos.

**Rationale**: El estado de resolución ya captura "qué se sabe sobre este evento"; agregar los estados de duplicación mantiene toda la información de estado del evento en un único campo indexado. Añadir un campo booleano separado `es_potencial_duplicado` crea un estado compuesto ambiguo (RESUELTO + booleano) y requiere cambios en todas las queries de "dame eventos válidos".

**State machine**:
```
SIN_RESOLVER → RESUELTO (colaborador resuelto)
RESUELTO → POTENCIAL_DUPLICADO (dedup detecta candidato)
POTENCIAL_DUPLICADO → DUPLICADO (descarte manual)
POTENCIAL_DUPLICADO → RESUELTO (confirmación como válido)
DISPOSITIVO_DESCONOCIDO (terminal — sin collaborador)
SIN_RESOLVER (terminal — sin colaborador conocido)
```

**Alternatives considered**:
- Campo `estado_procesamiento` separado: rechazado porque duplica información de estado y requiere enmiendas más invasivas a spec 003; además la consulta de "último evento válido" ya necesita filtrar por EstadoResolucion.

---

## Decision 4: Configuración de la ventana de deduplicación

**Decision**: Usar `ConfiguracionRegla` (ya en spec 003) con nuevo valor `DEDUP_WINDOW_MINUTES` en el enum `TipoConfiguracion`. `aplica_a = GLOBAL`, `valor = 2` (minutos) como default. El servicio lee esta config en cada verificación o la cachea con TTL corto.

**Rationale**: ConfiguracionRegla ya provee effective dating, versionado y auditoría para parámetros de negocio (Principio V). Reutilizarla evita crear una nueva tabla de configuración solo para un parámetro.

**Alternatives considered**:
- Variable de entorno: rechazado porque no es auditable ni modificable en runtime sin re-deploy.
- Tabla aparte `ConfiguracionSistema`: rechazado por innecesaria cuando ConfiguracionRegla ya cubre el caso.

---

## Decision 5: Integración con el cálculo de horas (spec 006)

**Decision**: El cálculo de horas en spec 006 ya filtra por colaborador + semana + estados de eventos. La integración consistirá en: los cálculos existentes SOLO consideran eventos con `estado_resolucion = RESUELTO`. Los eventos `POTENCIAL_DUPLICADO` se incluyen (igual que RESUELTO), mientras que los eventos `DUPLICADO` se excluyen. Esto se implementa añadiendo `estado_resolucion NOT IN ('DUPLICADO', 'SIN_RESOLVER', 'DISPOSITIVO_DESCONOCIDO')` a la query de cálculo.

**Rationale**: FR-005 especifica que solo los eventos DESCARTADOS (DUPLICADO) se excluyen; los POTENCIAL_DUPLICADO siguen en cálculos hasta decisión manual. La query de spec 006 ya filtra estados; extenderla es el cambio mínimo.

**Recálculo post-descarte**: Cuando un evento pasa a DUPLICADO, el sistema recalcula las horas del día afectado. El día se identifica por `checktime` del evento descartado. La recalculación es sincrónica dado el scope pequeño (un colaborador, un día).

---

## Decision 6: Relación self-referencial en Prisma

**Decision**: `evento_referencia_id` se define en Prisma con relación nombrada para evitar ambigüedad:

```prisma
model EventoBiometrico {
  // ...
  evento_referencia_id  String?  @db.Uuid
  evento_referencia     EventoBiometrico?  @relation("DuplicadoDe", fields: [evento_referencia_id], references: [id])
  eventos_derivados     EventoBiometrico[] @relation("DuplicadoDe")
}
```

**Rationale**: Prisma requiere relaciones nombradas en self-references. La relación inversa `eventos_derivados` permite consultar "qué otros eventos son potencial duplicado de este" sin un JOIN manual.

**Alternatives considered**:
- Solo guardar UUID sin FK de Prisma: rechazado porque pierde la integridad referencial y el type safety.
