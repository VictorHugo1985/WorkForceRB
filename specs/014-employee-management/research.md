# Research: Gestión Completa de Colaboradores

**Feature**: 014-employee-management | **Date**: 2026-05-26

---

## Decisión 1: Estrategia de carga y búsqueda de la lista

**Decision**: Cargar todos los colaboradores en una sola llamada GET y filtrar client-side con `Array.filter`.

**Rationale**: El spec establece un máximo de 500 colaboradores (SC-005). A 500 registros con
nombre, apellido, cédula, área y estado (~150 bytes/fila), la respuesta JSON no supera 75 KB —
perfectamente manejable en un solo fetch. Client-side filtering (`Array.filter` sobre el array
en memoria) es instantáneo (<1 ms) sin latencia de red. Esto cumple SC-001 (localizar en <5 s)
y SC-005 (carga <2 s). Se elimina complejidad de paginación server-side que causaría fricción
con el requisito de "tiempo real" (FR-002).

**Alternatives considered**:
- Debounced server-side search (PATCH con `?search=`): correcta para >10k registros, pero añade
  latencia de red en cada keystroke y requiere un endpoint más complejo.
- Paginación + botón "Buscar": simplifica el backend pero viola FR-002 (sin botón explícito).

---

## Decisión 2: Modo de edición inline vs. página separada

**Decision**: Toggle inline en `/colaboradores/{id}` — los campos se vuelven editables al hacer
clic en "Editar"; "Cancelar" restaura la vista original con `useState`.

**Rationale**: Evita navegación extra (sin URL separada), mantiene el contexto del perfil visible
(área, tarifa, códigos), y es el patrón más simple de implementar con MUI (`TextField` vs
`Typography` condicional). El estado del modo (view/edit) vive en el componente cliente sin
routing adicional.

**Alternatives considered**:
- `/colaboradores/{id}/editar` (página separada): añade URL, permite back-button, pero genera
  una pantalla casi idéntica al perfil. Innecesario para 5 campos.
- Modal/Drawer overlay: más complejo (z-index, scroll), sin beneficio real para un formulario
  de 5 campos.

---

## Decisión 3: Confirmación de baja

**Decision**: MUI `<Dialog>` con título, mensaje descriptivo y botones "Dar de baja" (color error)
y "Cancelar". La acción PATCH a `/api/colaboradores/{id}/estado` se ejecuta solo al confirmar.

**Rationale**: Patrón estándar MUI para acciones destructivas. No requiere nueva ruta, mantiene
al usuario en el perfil, y es explícitamente reversible (FR-014 reactivación).

**Alternatives considered**:
- Snackbar con undo: más moderno, pero requiere ejecutar la acción primero y luego revertirla,
  lo cual es más complejo y contraintuitivo para una baja.
- Página de confirmación: fricción innecesaria para esta acción.

---

## Decisión 4: GET /api/colaboradores — diseño de respuesta

**Decision**: El endpoint retorna todos los colaboradores (activos e inactivos) en un array.
El filtrado por `activo` se realiza client-side junto con la búsqueda de texto.

**Rationale**: Dado que se carga todo, tiene sentido incluir inactivos en la misma llamada para
que el toggle "Mostrar inactivos" (FR-003) no requiera otra llamada al servidor. La respuesta
incluye: id, nombre, apellido, cédula, activo, area (id+nombre mediante JOIN).

**SQL**:
```sql
SELECT c.id, c.nombre, c.apellido, c.cedula, c.activo,
       a.id AS area_id, a.nombre AS area_nombre
FROM colaboradores c
LEFT JOIN areas a ON a.id = c.area_id
ORDER BY c.apellido, c.nombre
```

---

## Decisión 5: PATCH /api/colaboradores/{id} — campos editables

**Decision**: El endpoint acepta un subset de campos (nombre, apellido, cédula, area_id,
supervisor_id). Valida unicidad de cédula excluyendo al colaborador actual (FR-010).
Registra en `registros_auditoria` (Principio IX).

**Rationale**: Separar el endpoint de baja (`PATCH /estado`) del endpoint de edición de datos
permite contratos más claros y auditabilidad diferenciada. La validación de cédula duplicada
excluye el ID actual: `WHERE cedula = $1 AND id != $2`.

---

## Decisión 6: Patrón de edición en ColaboradorPerfil

**Decision**: `ColaboradorPerfil.tsx` se convierte en un componente con dos modos controlados
por `isEditing: boolean`. En modo vista, muestra `Typography`. En modo edición, muestra
`TextField`s pre-poblados con `useForm` (React Hook Form + Zod).

**Rationale**: Consistente con la convención ya establecida en el proyecto (React Hook Form +
Zod en el wizard). Zod valida nombre/apellido (min 1) y cédula (min 1) antes del submit.

---

## Decisión 7: Estado colaborador y eventos biométricos

**Decision**: Al dar de baja (activo = false), los eventos futuros con el workno del colaborador
quedarán sin resolver (NULL en colaborador_id o estado SIN_RESOLVER). No se desactiva el
`codigo_colaborador` — eso es responsabilidad de otro flujo.

**Rationale**: FR-015 establece que el colaborador inactivo "deja de resolver nuevos eventos".
La lógica de resolución de eventos ya filtra por `c.activo = true` al hacer JOIN. No es
necesario modificar `codigos_colaborador` al dar de baja.
