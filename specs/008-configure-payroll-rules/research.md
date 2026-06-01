# Research: Feature 008 — Configuración de Tarifa y Plantillas de Horario

## Decision 1: Almacenamiento de tarifa_hora

**Decision**: Continuar usando `configuraciones_reglas` con tipo `TARIFA_HORA` y effective dating.

**Rationale**: La tabla ya existe y está integrada con el calculador de liquidaciones en ambas capas (web `liquidacion-db.ts` línea ~79 y NestJS `liquidacion-calculator.service.ts` línea 79). El flujo de actualización es:
1. `vigente_hasta` del registro activo = hoy - 1 día (cierre)
2. INSERT nuevo registro con `vigente_desde` = hoy y `vigente_hasta` = NULL (indefinido)

Las liquidaciones aprobadas no se recalculan porque almacenan `total_pago` calculado en el momento de aprobación — el effective dating solo afecta cálculos futuros.

**Alternatives considered**:
- Columna `tarifa_hora` directa en `colaboradores` — más simple, pero pierde el historial y rompe la integración existente con `resolveConfigRule`.
- PATCH directo del registro existente — viola el patrón de auditoría y pierde historial.

---

## Decision 2: Almacenamiento de plantilla_horario

**Decision**: Nueva tabla `plantillas_horario` con FK directa en `colaboradores.plantilla_horario_id`.

**Rationale**: La asignación de plantilla es una propiedad de configuración actual del colaborador, no versionada. El atraso se detecta en tiempo de creación de días de liquidación usando la plantilla vigente en ese momento. No hay requisito de saber qué plantilla tenía el colaborador en una semana pasada — las liquidaciones antiguas ya tienen `atraso_detectado` almacenado.

**Constitution V trade-off**: El principio V exige versionado con fecha de vigencia para configuraciones. Para plantillas, esto se justifica como excepción explícita: la detección de atraso solo es relevante para períodos activos/futuros; los períodos pasados ya tienen `atraso_detectado` calculado y almacenado en `dias_liquidacion`.

**Alternatives considered**:
- Registrar plantilla en `configuraciones_reglas` (tipo nuevo `PLANTILLA_HORARIO_ID`) — complejo de implementar y consultar; el valor sería un UUID, no un Decimal.
- Tabla de asignación separada — sobre-ingeniería para un requisito de asignación directa 1:1.

---

## Decision 3: Formato de días laborables

**Decision**: `TEXT[]` PostgreSQL — array de nombres de días `['LUNES', 'MARTES', ...]`.

**Rationale**: Legible en SQL, validable en aplicación, mapea a `String[]` en Prisma sin extensión adicional. PostgreSQL soporta operadores de array para queries futuras (`@>` para "incluye día").

**Alternatives considered**:
- Bitmask entero — compacto pero opaco; difícil de debuggear en la DB.
- JSONB — más flexible pero innecesario para un array plano de strings.
- 7 columnas booleanas — verbose en schema y queries.

---

## Decision 4: Cálculo de atraso_detectado

**Decision**: Calculado al crear/actualizar `dias_liquidacion` en `liquidacion-db.ts` (`findOrCreateBorrador` y `crearDiasParaLiquidacion`).

**Rationale**: El campo `atraso_detectado` ya existe en `dias_liquidacion` pero siempre se inserta como `false`. El momento correcto de calcularlo es cuando se procesan los punches y se crea el día, ya que en ese momento tenemos acceso al primer ENTRADA del día y a la plantilla del colaborador.

**Lógica**: 
```
atraso = ¿el colaborador tiene plantilla? 
  AND ¿la fecha.weekday está en plantilla.dias_laborables?
  AND ¿primer punch ENTRADA del día > plantilla.hora_entrada_esperada?
```

**Alternatives considered**:
- Al recibir el evento biométrico (webhook) — demasiado temprano, la plantilla podría cambiar.
- Al aprobar la liquidación — demasiado tarde, el supervisor necesita ver el indicador antes.
- En tiempo real (computed, no stored) — requiere JOIN costoso en cada render.

---

## Decision 5: Arquitectura de la UI de plantillas

**Decision**: Nueva página `/horarios` con lista de plantillas + Dialog para crear/editar (patrón Server Component + Client component, igual que `/colaboradores`).

**Rationale**: Las plantillas son una entidad administrativa independiente, no acoplada al perfil de un colaborador. Merecen su propia sección de navegación. La asignación de plantilla a colaborador sí va en el perfil del colaborador (sección "Configuración salarial").

**Plantilla management page** (`/horarios/page.tsx`):
- Server Component que obtiene la lista inicial de plantillas
- `PlantillasHorarioList` (Client) con botón Crear + filas con Editar/Eliminar
- `PlantillaHorarioDialog` (Client) para crear y editar

---

## Decision 6: Sección de tarifa en ColaboradorPerfil

**Decision**: Añadir botón "Editar tarifa" en la sección "Tarifa salarial" existente de `ColaboradorPerfil.tsx`. Usa un `Dialog` inline (patrón ya establecido en `DiaAjusteDialog`). Llama a `PATCH /api/colaboradores/[id]/tarifa`.

**Rationale**: La sección "Tarifa salarial" ya existe en el perfil (línea ~394). Solo falta el botón de edición y el endpoint. Reutiliza el patrón de Dialog existente en el proyecto.

---

## Decision 7: Lista de colaboradores con indicador de tarifa

**Decision**: Actualizar `GET /api/colaboradores` para incluir `tarifa_hora_valor` (nullable) usando un subquery lateral. Actualizar `ColaboradoresListClient.tsx` para mostrar la columna con Chip "Sin tarifa" cuando es null.

**Rationale**: FR-005 + SC-005 requieren que el listado muestre la tarifa vigente con indicador visual para los sin tarifa. La query existente ya hace JOIN a `areas`; agregar un subquery lateral para `configuraciones_reglas` es directo y mantiene la misma estructura de respuesta con un campo adicional.
