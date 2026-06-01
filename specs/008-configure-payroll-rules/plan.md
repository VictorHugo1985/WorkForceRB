# Implementation Plan: 008 — Configuración de Tarifa y Plantillas de Horario

**Branch**: `008-configure-payroll-rules` | **Date**: 2026-06-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/008-configure-payroll-rules/spec.md`

## Summary

Habilitar al administrador para (1) actualizar la tarifa horaria (Bs./h) directamente en el perfil del colaborador con log de auditoría, y (2) crear/gestionar plantillas de horario (nombre + días laborables + hora de entrada) para la detección automática de atrasos en liquidaciones. La tarifa usa la tabla `configuraciones_reglas` existente con effective dating. Las plantillas son una nueva tabla `plantillas_horario` con FK directa en `colaboradores`.

## Technical Context

**Language/Version**: TypeScript / Node.js 20 (Next.js 14 App Router)

**Primary Dependencies**: 
- Next.js 14 (App Router, Route Handlers)
- MUI v5 (Material UI) + Emotion
- React Hook Form + Zod
- pg (node-postgres pool) — conexión directa a PostgreSQL
- Prisma (solo para schema reference; web app usa pg pool directo)

**Storage**: PostgreSQL via Supabase (Session Pooler)

**Testing**: Manual (no test suite en web layer)

**Target Platform**: Web (Next.js, Vercel/Supabase)

**Project Type**: Web application — monorepo (`apps/web` es el scope de esta feature)

**Performance Goals**: Respuesta de endpoints < 500ms. Lista de colaboradores con tarifa usando subquery lateral.

**Constraints**: 
- Solo ADMIN role puede acceder a estos endpoints
- Tarifa `> 0`; días laborables array no vacío; hora_entrada válida HH:MM
- No eliminar plantilla si tiene colaboradores asignados

**Scale/Scope**: ~30–100 colaboradores, ~5–10 plantillas de horario

## Constitution Check

| Principio | Evaluación | Notas |
|-----------|-----------|-------|
| I. Arquitectura basada en datos | ✅ PASS | Migración SQL define schema antes de implementar |
| II. Código limpio y modular | ✅ PASS | Route handlers independientes, componentes con SRP |
| III. Inmutabilidad biométrica | ✅ PASS | No toca `eventos_biometricos` |
| IV. Cálculo determinístico y auditable | ✅ PASS | tarifa usa effective dating en `configuraciones_reglas`; audit log obligatorio |
| V. Reglas de negocio configurables | ⚠️ JUSTIFIED | Plantilla sin effective dating — excepción documentada en research.md §Decision 2 |
| VI. Ciclo semanal | N/A | No afecta ciclo de pago |
| VII. Integración biométrica | N/A | No afecta integración |
| VIII. RBAC | ✅ PASS | `checkAdminRole` en todos los endpoints nuevos |
| IX. Trazabilidad de ajustes | ✅ PASS | FR-010: audit log en cada cambio de tarifa y plantilla |
| X. Disponibilidad tiempo real | N/A | No afecta vistas en tiempo real |
| XI. Seguridad y protección | ✅ PASS | Auth obligatoria, validación en backend |

**Violations**: Ninguna. Principio V tiene excepción justificada (plantilla sin effective dating porque atraso_detectado ya se almacena en dias_liquidacion al calcular).

## Project Structure

### Documentation (this feature)

```text
specs/008-configure-payroll-rules/
├── plan.md              ← este archivo
├── research.md          ✅ creado
├── data-model.md        ✅ creado
├── contracts/
│   └── api.md           ✅ creado
└── tasks.md             (pendiente — /speckit-tasks)
```

### Source Code (repository root)

```text
apps/api/prisma/migrations/
└── 20260601_008_schedule_templates/
    └── migration.sql                          (NEW)

packages/database/prisma/schema.prisma         (MOD — PlantillaHorario model, Colaborador.plantilla_horario_id)
apps/api/prisma/schema.prisma                  (MOD — mismo cambio, spec mirror)

apps/web/src/
├── app/
│   ├── (app)/
│   │   └── horarios/
│   │       └── page.tsx                       (NEW — Server Component, lista plantillas)
│   └── api/
│       ├── colaboradores/
│       │   ├── route.ts                       (MOD — agregar tarifa_hora_valor al GET list)
│       │   └── [id]/
│       │       ├── route.ts                   (MOD — GET: agregar plantilla_horario; PATCH: agregar plantilla_horario_id)
│       │       └── tarifa/
│       │           └── route.ts               (NEW — PATCH: actualizar tarifa con effective dating)
│       └── plantillas-horario/
│           ├── route.ts                       (NEW — GET list, POST create)
│           └── [id]/
│               └── route.ts                   (NEW — GET detail, PATCH update, DELETE)
├── components/
│   ├── colaboradores/
│   │   └── ColaboradorPerfil.tsx              (MOD — añadir TarifaEditDialog inline + sección plantilla)
│   ├── horarios/
│   │   ├── PlantillasHorarioList.tsx          (NEW — tabla con Create/Edit/Delete)
│   │   └── PlantillaHorarioDialog.tsx         (NEW — dialog create/edit con form validado)
│   └── layout/
│       └── AppSidebar.tsx                     (MOD — añadir icono para /horarios)
└── lib/
    ├── liquidacion-db.ts                      (MOD — atraso_detectado desde plantilla)
    └── nav-config.ts                          (MOD — añadir /horarios a NAV_ITEMS y ROUTE_ROLES)
```

## Phase 0: Research ✅ COMPLETE

Ver `research.md` para todas las decisiones. Resumen de unknowns resueltos:

1. ✅ Tarifa usa `configuraciones_reglas` existente — no nueva tabla
2. ✅ Plantilla = nueva tabla `plantillas_horario` con FK directa en `colaboradores`
3. ✅ Días laborables = `TEXT[]` PostgreSQL
4. ✅ `atraso_detectado` calculado en `liquidacion-db.ts` al crear días
5. ✅ UI: `/horarios` nueva página; tarifa en perfil con Dialog

## Phase 1: Design & Contracts ✅ COMPLETE

Ver `data-model.md` y `contracts/api.md`.

## Implementation Notes

### Tarea crítica: Migración DB

Debe ejecutarse en Supabase antes de cualquier otra tarea. Usa Session Pooler `aws-1-us-east-1.pooler.supabase.com:5432` (el `aws-0` falla DNS).

```sql
-- Crear tabla plantillas_horario
CREATE TABLE plantillas_horario (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  nombre                TEXT        NOT NULL,
  dias_laborables       TEXT[]      NOT NULL,
  hora_entrada_esperada TIME        NOT NULL,
  creado_por            UUID        NOT NULL REFERENCES usuarios(id),
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plantillas_horario_pkey PRIMARY KEY (id),
  CONSTRAINT plantillas_horario_nombre_key UNIQUE (nombre)
);

-- Agregar FK en colaboradores
ALTER TABLE colaboradores 
  ADD COLUMN plantilla_horario_id UUID REFERENCES plantillas_horario(id) ON DELETE SET NULL;
```

### Lógica de atraso_detectado

En `liquidacion-db.ts`, la función que inserta días (`crearDiasParaLiquidacion` / `findOrCreateBorrador`) debe:

```typescript
// 1. Obtener plantilla del colaborador (una vez, fuera del loop de días)
const plantillaRes = await client.query(
  `SELECT ph.dias_laborables, ph.hora_entrada_esperada::text
   FROM colaboradores c
   LEFT JOIN plantillas_horario ph ON ph.id = c.plantilla_horario_id
   WHERE c.id = $1`,
  [colaboradorId]
);
const plantilla = plantillaRes.rows[0];

// 2. Para cada día en el punch map:
for (const [fecha, punches] of punchMap) {
  let atrasoDetectado = false;
  
  if (plantilla?.dias_laborables && plantilla?.hora_entrada_esperada) {
    const diaSemana = getDiaSemana(fecha); // 'LUNES', 'MARTES', etc.
    if (plantilla.dias_laborables.includes(diaSemana)) {
      const primeraEntrada = punches
        .filter(p => p.tipo === 'ENTRADA')
        .sort((a, b) => a.recibido_en < b.recibido_en ? -1 : 1)[0];
      if (primeraEntrada) {
        const horaEntrada = primeraEntrada.recibido_en.slice(11, 16); // 'HH:MM'
        atrasoDetectado = horaEntrada > plantilla.hora_entrada_esperada.slice(0, 5);
      }
    }
  }
  
  await client.query(
    `INSERT INTO dias_liquidacion (id, liquidacion_id, fecha, horas_calculadas, atraso_detectado, estado_dia)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'SIN_REVISION')
     ON CONFLICT (liquidacion_id, fecha) DO UPDATE SET atraso_detectado = EXCLUDED.atraso_detectado
     WHERE dias_liquidacion.estado_dia = 'SIN_REVISION'`,
    [liquidacionId, fecha, horasParejadas, atrasoDetectado]
  );
}
```

**Función helper** (agregar en `liquidacion-db.ts`):
```typescript
function getDiaSemana(fechaISO: string): string {
  const dias = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const d = new Date(fechaISO + 'T12:00:00Z'); // UTC noon to avoid DST issues
  return dias[d.getUTCDay()];
}
```

### Patrón de actualización de tarifa

En `PATCH /api/colaboradores/[id]/tarifa/route.ts`:

```typescript
// 1. Fetch existing tarifa for audit log
const existingRes = await client.query(
  `SELECT id, valor FROM configuraciones_reglas 
   WHERE colaborador_id = $1 AND tipo = 'TARIFA_HORA' AND vigente_hasta IS NULL
   ORDER BY vigente_desde DESC LIMIT 1`,
  [colaboradorId]
);
const existing = existingRes.rows[0] ?? null;

// 2. Close existing record
if (existing) {
  await client.query(
    `UPDATE configuraciones_reglas SET vigente_hasta = CURRENT_DATE - 1
     WHERE id = $1`,
    [existing.id]
  );
}

// 3. Insert new record
const insertRes = await client.query(
  `INSERT INTO configuraciones_reglas 
   (tipo, clave, valor, unidad, aplica_a, colaborador_id, vigente_desde, creado_por)
   VALUES ('TARIFA_HORA', 'Tarifa hora ordinaria', $1, 'Bs.', 'COLABORADOR', $2, CURRENT_DATE, $3)
   RETURNING id, valor, unidad, vigente_desde::text`,
  [valor, colaboradorId, userId]
);

// 4. Audit log
await client.query(
  `INSERT INTO registros_auditoria 
   (accion, entidad_tipo, entidad_id, usuario_id, descripcion, ip_origen, datos_anteriores, datos_nuevos)
   VALUES ('TARIFA_HORA_ACTUALIZADA', 'Colaborador', $1, $2, $3, $4, $5, $6)`,
  [colaboradorId, userId, `Actualización tarifa: ${existing?.valor ?? 'N/A'} → ${valor} Bs./h`,
   ip, JSON.stringify({ valor: existing?.valor ?? null }), JSON.stringify({ valor })]
);
```

### ColaboradorPerfil — TarifaEditDialog

Añadir en la sección "Tarifa salarial" (línea ~394) un botón "Editar" que abre un Dialog con:
- Campo `valor` (number, > 0) pre-rellenado con `tarifa_vigente.valor`
- `POST PATCH /api/colaboradores/${perfil.id}/tarifa`
- Al éxito: actualiza `tarifa_vigente` local en el estado del componente

### ColaboradorPerfil — Sección Plantilla Horario

Añadir sección "Plantilla de horario" con:
- Selector de plantilla (fetches `/api/plantillas-horario` on open)
- `PATCH /api/colaboradores/${perfil.id}` con `plantilla_horario_id`
- Muestra nombre + días + hora_entrada de la plantilla activa (o "Sin plantilla")

### PlantillaHorarioDialog

Form fields:
1. `nombre` — TextField
2. `dias_laborables` — CheckboxGroup (LUNES–DOMINGO, mínimo 1 seleccionado)
3. `hora_entrada_esperada` — TextField type="time"

Validaciones Zod en frontend:
```typescript
const PlantillaSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  dias_laborables: z.array(z.string()).min(1, 'Seleccione al menos un día'),
  hora_entrada_esperada: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM requerido'),
});
```

### nav-config.ts

Agregar entrada con rol ADMINISTRADOR:
```typescript
{ label: 'Horarios', href: '/horarios', roles: ['ADMINISTRADOR'] },
```

### AppSidebar.tsx

Agregar icono para `/horarios` en `NAV_ICONS`:
```typescript
import ScheduleIcon from '@mui/icons-material/Schedule';
// ...
'/horarios': <ScheduleIcon fontSize="small" />,
```

## Complexity Tracking

| Item | Justificación |
|------|---------------|
| Plantilla sin effective dating | Excepción justificada: atraso_detectado ya almacenado en dias_liquidacion; no hay cálculo retroactivo que requiera saber la plantilla histórica |
