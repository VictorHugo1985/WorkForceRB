# Research: Registro de Nuevo Colaborador

**Feature**: 004-register-employee | **Date**: 2026-05-25

---

## D1 — Enmienda al modelo de datos: tabla `areas`

**Decision**: Agregar tabla catálogo `areas` (id, nombre, activo) y FK `area_id` en `colaboradores`.

**Rationale**: El spec 003 no incluye este campo. La clarificación definió que el área es un catálogo seleccionable (FK), no texto libre. La enmienda es aditiva (nueva tabla + nuevo campo nullable inicialmente) — no rompe datos existentes.

**Migration strategy**: `CREATE TABLE areas ...` → `ALTER TABLE colaboradores ADD COLUMN area_id UUID REFERENCES areas(id)` (nullable para no bloquear datos existentes) → poblar con áreas iniciales vía seed.

**Alternatives considered**: Texto libre (rechazado: sin estandarización para filtros futuros); enum fijo (rechazado: requiere migración para añadir áreas).

---

## D2 — Wizard UI: React Hook Form con estado por pasos

**Decision**: Formulario multi-paso gestionado con React Hook Form (RHF) + Zod, usando un componente `Stepper` de MUI v5. El estado del formulario se mantiene en el componente padre del wizard; cada paso valida sus campos con Zod antes de permitir avanzar.

**Rationale**: RHF + Zod ya están en el stack aprobado (Constitución). `Stepper` de MUI v5 provee el componente visual correcto sin dependencias adicionales. `useFormContext` de RHF permite compartir el estado del formulario entre pasos sin prop drilling.

**Pasos del wizard** (6):
1. Datos personales: nombre, apellido, cédula
2. Área y supervisor: area_id (requerido), supervisor_id (opcional)
3. Tarifa salarial: valor en COP por hora (opcional — se omite si no se configura)
4. Horario laboral: horas_diarias y umbral_horas_extra (opcional)
5. Código biométrico: dispositivo + workno (opcional)
6. Confirmación: resumen de todos los datos + submit final

**Alternatives considered**: Formulario de página única (rechazado por clarificación Q2); pasos guardados individualmente (rechazado — genera inconsistencias parciales innecesarias; los datos se envían en una sola solicitud al confirmar).

---

## D3 — API layer: POST /api/colaboradores con partial success

**Decision**: Un único endpoint `POST /api/colaboradores` que recibe todos los datos del wizard (colaborador + tarifa opcional + horario opcional + código biométrico opcional). El colaborador se inserta en transacción DB. Las configuraciones y el código se insertan con best-effort: si fallan, el colaborador ya está creado y la respuesta incluye warnings.

**Rationale**: La respuesta B de la clarificación Q3 establece guardado parcial: el colaborador se crea siempre; el resto puede completarse después. Enviar todos los datos en una sola request al final del wizard es más simple que múltiples endpoints y evita estados inconsistentes a nivel de UI.

**Response shape**:
```json
{
  "colaborador": { "id": "...", "nombre": "...", ... },
  "warnings": [
    "Tarifa no configurada: no se pudo insertar configuracion_regla (motivo)",
    "Código biométrico no asignado: workno duplicado en dispositivo"
  ]
}
```

**Alternatives considered**: Múltiples endpoints por paso (rechazado — más complejo, más roundtrips, sin ventajas para este volumen); transacción atómica completa (rechazado — clarificación Q3 eligió B: parcial).

---

## D4 — Herencia de tarifa global: lookup en tiempo de cálculo

**Decision**: Cuando un colaborador no tiene `ConfiguracionRegla` de tipo `TARIFA_HORA` con `aplica_a = COLABORADOR`, el motor de liquidación busca la regla de alcance `GLOBAL` vigente en el período calculado. Esta feature no implementa el motor de liquidación — solo garantiza que el colaborador quede bien registrado para que el motor futuro lo resuelva correctamente.

**Rationale**: Clarificación Q4 eligió A. El modelo de `configuraciones_reglas` ya soporta esto con el campo `aplica_a { GLOBAL, COLABORADOR }` — no requiere cambios al esquema.

**Scope para esta feature**: El wizard muestra un paso de tarifa con advertencia si se omite ("Sin tarifa propia, se usará la tarifa global vigente al momento de liquidar"). No hay lógica de cálculo en esta feature.

---

## D5 — Validación de unicidad: cédula y workno+dispositivo

**Decision**: Validación en el API route con errores HTTP 409 específicos por campo.
- Cédula: `SELECT id FROM colaboradores WHERE cedula = $1` (sin filtro activo — rechaza duplicados de cualquier estado)
- workno+dispositivo: `UNIQUE (dispositivo_id, codigo_biometrico)` ya está en el modelo via constraint de BD; el INSERT fallará con `23505` y el handler lo mapea a 409

**Rationale**: El constraint de BD es la fuente de verdad para la unicidad del código biométrico. La validación de cédula se hace en el handler porque incluye colaboradores inactivos (clarificación Q4 del spec: unicidad sin importar estado).

---

## D6 — Audit log de registro de colaborador

**Decision**: Al crear un colaborador exitosamente, insertar en `registros_auditoria`:
```sql
accion = 'COLABORADOR_REGISTRADO'
entidad_tipo = 'Colaborador'
entidad_id = <nuevo id>
datos_nuevos = JSON del colaborador + configuraciones + codigos creados
usuario_id = <id del usuario autenticado>
```

**Rationale**: FR-010 y Constitución Principio IX exigen trazabilidad. El patrón es consistente con el audit log del webhook (T019 en spec 001).

---

## D7 — Autorización: verificación de rol ADMINISTRADOR

**Decision**: El API route verifica el JWT via `verifyToken()` de `apps/web/src/lib/auth-server.ts` y comprueba que el payload incluya el rol `ADMINISTRADOR`. Si no, retorna 403.

**Rationale**: FR-001. La función `verifyToken` ya existe. El JWT incluye los roles del usuario en el claim `roles` (arreglo de strings).

---

## D8 — Listado de áreas y supervisores para el wizard

**Decision**: 
- `GET /api/areas` — lista todas las áreas activas para el dropdown del paso 2
- `GET /api/usuarios/supervisores` — lista usuarios con rol `ADMINISTRADOR` o `SUPERVISOR` para el dropdown del supervisor (opcional)

**Rationale**: El wizard necesita poblar dropdowns antes de que el usuario seleccione. Dos endpoints de solo lectura ligeros, sin paginación (volúmenes bajos esperados en MVP).
