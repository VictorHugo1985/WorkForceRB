# Feature Specification: Eliminar Período de Liquidación

**Feature Branch**: `020-delete-periodo-liquidacion`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Permitir en los periodos de liquidacion poder eliminar uno de la lista (de los ya creados)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Eliminar un período sin liquidaciones finalizadas (Priority: P1)

El administrador ve la lista de períodos de liquidación y necesita eliminar uno que fue creado por error o que ya no es necesario. El período no tiene liquidaciones aprobadas ni pagadas, por lo que puede eliminarse de forma segura.

**Why this priority**: Es el flujo principal. Permite corregir errores de configuración sin necesidad de asistencia técnica.

**Independent Test**: Crear un período de liquidación sin aprobar ninguna liquidación → hacer clic en "Eliminar" → confirmar → verificar que desaparece de la lista.

**Acceptance Scenarios**:

1. **Given** un período en estado ABIERTA sin liquidaciones aprobadas ni pagadas, **When** el administrador hace clic en "Eliminar" y confirma el diálogo, **Then** el período desaparece de la lista y se muestra un mensaje de éxito.
2. **Given** un período en estado ABIERTA con liquidaciones en estado BORRADOR, **When** el administrador confirma la eliminación, **Then** el período y sus borradores de liquidación se eliminan en cascada y el período desaparece de la lista.
3. **Given** el administrador inicia la eliminación, **When** aparece el diálogo de confirmación, **Then** puede cancelar y el período permanece sin cambios.

---

### User Story 2 — Bloquear eliminación de períodos con liquidaciones finalizadas (Priority: P2)

El sistema impide eliminar períodos que ya tienen liquidaciones aprobadas o pagadas, protegiendo la integridad del historial financiero.

**Why this priority**: Garantía de auditoría. Un período con liquidaciones aprobadas o pagadas es parte del historial de pagos y no debe poder borrarse.

**Independent Test**: Aprobar al menos una liquidación en un período → intentar eliminarlo → verificar que el sistema muestra un error explicativo y el período permanece en la lista.

**Acceptance Scenarios**:

1. **Given** un período con al menos una liquidación en estado APROBADO o PAGADO, **When** el administrador intenta eliminarlo, **Then** el sistema muestra un mensaje de error indicando que el período tiene liquidaciones finalizadas y no puede eliminarse.
2. **Given** un período en estado CERRADA, **When** el administrador intenta eliminarlo, **Then** el sistema muestra un mensaje de error indicando que los períodos cerrados no pueden eliminarse.

---

### Edge Cases

- ¿Qué ocurre con los bonos registrados en el período si se elimina? Los bonos se eliminan junto con el período, dado que solo se puede eliminar si no hay liquidaciones aprobadas o pagadas.
- ¿Puede un SUPERVISOR eliminar períodos? No — solo ADMINISTRADOR tiene este permiso; el botón de eliminar no es visible para otros roles.
- ¿Qué pasa si otro usuario está viendo la planilla de ese período cuando es eliminado? La pantalla de planilla mostrará un error de "período no encontrado" en su siguiente acción.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE mostrar una acción de "Eliminar" por cada período en la lista de períodos de liquidación, visible únicamente para ADMINISTRADOR.
- **FR-002**: Al iniciar la eliminación, el sistema DEBE mostrar un diálogo de confirmación con las fechas del período antes de proceder.
- **FR-003**: El sistema DEBE permitir la eliminación únicamente si ninguna liquidación del período tiene estado APROBADO o PAGADO.
- **FR-004**: El sistema DEBE rechazar la eliminación de períodos en estado CERRADA, mostrando un mensaje de error explicativo.
- **FR-005**: Al eliminar un período, el sistema DEBE eliminar en cascada todas las liquidaciones en estado BORRADOR asociadas a ese período.
- **FR-006**: Tras una eliminación exitosa, el período DEBE desaparecer de la lista de forma inmediata sin recargar la página completa.
- **FR-007**: Si la eliminación es bloqueada, el sistema DEBE mostrar un mensaje de error claro que explique el motivo (liquidaciones finalizadas o período cerrado).
- **FR-008**: Toda eliminación exitosa DEBE quedar registrada en el historial de auditoría con el período afectado, las fechas, y el usuario que realizó la acción.

### Key Entities

- **Período de liquidación**: Período con fechas de inicio y fin, estado (ABIERTA/CERRADA) y liquidaciones de colaboradores asociadas.
- **Liquidación de colaborador**: Registro de pago de un colaborador dentro de un período. Puede estar en estado BORRADOR, APROBADO o PAGADO. Solo las BORRADOR son eliminables en cascada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El administrador puede completar una eliminación exitosa en 3 interacciones o menos (clic en eliminar → confirmar → resultado visible).
- **SC-002**: El resultado de la operación (éxito o error) se muestra al usuario en menos de 2 segundos.
- **SC-003**: Ningún período con liquidaciones en estado APROBADO o PAGADO puede ser eliminado bajo ninguna circunstancia.
- **SC-004**: El 100% de las eliminaciones exitosas quedan registradas en el historial de auditoría.

## Assumptions

- Solo ADMINISTRADOR puede eliminar períodos; SUPERVISOR y otros roles no ven la opción.
- Un período en estado CERRADA nunca puede eliminarse, independientemente del estado de sus liquidaciones.
- Los bonos del período se eliminan en cascada junto con las liquidaciones BORRADOR cuando la eliminación procede.
- La eliminación es permanente; no existe papelera ni mecanismo de recuperación.
- El botón de eliminar aparece en la lista de períodos, no en la vista de detalle de planilla.
