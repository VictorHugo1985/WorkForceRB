# Data Model: Tipo de Colaborador — Campo Fijo

**One table change. No new tables.**

---

## Schema Change

### colaboradores (amended)

Add one column to the existing `colaboradores` table:

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `fijo` | `BOOLEAN NOT NULL` | `false` | `true` = salario fijo (excluido de liquidaciones por horas); `false` = jornalero (comportamiento actual) |

**Migration**: `ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS fijo BOOLEAN NOT NULL DEFAULT false;`

**Retroactive default**: All existing rows receive `fijo = false`, preserving current behavior for all collaborators without requiring a data backfill.

---

## Updated Prisma Model

Both `packages/database/prisma/schema.prisma` and `apps/api/prisma/schema.prisma` receive the same addition:

```prisma
model Colaborador {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nombre                String
  apellido              String
  cedula                String   @unique
  telefono              String?  @db.VarChar(30)
  fecha_nacimiento      DateTime? @db.Date
  activo                Boolean  @default(true)
  fijo                  Boolean  @default(false)   // ← new
  supervisor_id         String?  @db.Uuid
  tarifa_hora           Decimal? @db.Decimal(15, 4)
  tipo_pago             TipoPeriodoPago?
  plantilla_horario_id  String?  @db.Uuid
  creado_en             DateTime @default(now()) @db.Timestamptz
  actualizado_en        DateTime @updatedAt @db.Timestamptz
  // ... relations unchanged ...
}
```

---

## Query Pattern Change

### planilla/[semanaId]/route.ts — roster query

The collaborator roster for a semana laboral currently filters by:
- Active codes: `cc.activo = true`
- Punch events in date range
- Optional `tipo_pago` match

**Addition**: `AND c.fijo = false` on the `colaboradores` join:

```sql
-- Before (simplified):
WHERE ($3::text IS NULL OR c.tipo_pago::text = $3)

-- After:
WHERE ($3::text IS NULL OR c.tipo_pago::text = $3)
  AND c.fijo = false
```

This is the **sole enforcement point**. No downstream liquidation tables need changes.

---

## Audit Trail

Changes to `fijo` are logged in `registros_auditoria` via the existing PATCH audit block in `apps/web/src/app/api/colaboradores/[id]/route.ts`. The `datos_anteriores` and `datos_nuevos` JSON objects must include the `fijo` field value.

---

## State Transitions

The `fijo` field has no lifecycle state machine — it is a simple boolean that can be toggled at any time by ADMINISTRADOR. The classification vigente at calculation time determines behavior (not historical).

---

## No New Tables or Migrations Beyond

The column addition is the complete schema change for this feature.
