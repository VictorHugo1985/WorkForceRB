# Data Model: Feature 008 — Configuración de Tarifa y Plantillas de Horario

## Resumen de cambios

Feature 008 introduce **una nueva tabla** (`plantillas_horario`) y **dos nuevas columnas** en `colaboradores` (`tarifa_hora` y `plantilla_horario_id`).

La tabla `configuraciones_reglas` — diseñada originalmente para reglas de nómina con effective dating — **se elimina** porque:
- `TARIFA_HORA` migra a `colaboradores.tarifa_hora` (columna directa)
- `UMBRAL_HORA_EXTRA` y `MULTIPLICADOR_HORA_EXTRA` se eliminan (no hay horas extra)
- Los demás tipos (`BONO_*`, `DESCUENTO`, `DEDUP_WINDOW_MINUTES`, `ASISTENCIA_MINIMA`) nunca fueron consumidos por código activo

---

## Tabla eliminada: `configuraciones_reglas`

Esta tabla y sus tipos asociados (`TipoConfiguracion`, `AplicaA`) se eliminan en la migración 008.

**Dato existente preservado**: Los valores de `TARIFA_HORA` activos se migran a `colaboradores.tarifa_hora` antes del DROP.

---

## Tabla modificada: `colaboradores`

**Cambios**: Agregar dos columnas nuevas.

```sql
ALTER TABLE colaboradores
  ADD COLUMN tarifa_hora          DECIMAL(15,4),
  ADD COLUMN plantilla_horario_id UUID REFERENCES plantillas_horario(id) ON DELETE SET NULL;
```

| Campo                | Tipo           | Descripción                                              |
|----------------------|----------------|----------------------------------------------------------|
| tarifa_hora          | DECIMAL(15,4)? | Tarifa en Bs./h; NULL = sin tarifa configurada           |
| plantilla_horario_id | UUID? FK       | Plantilla de horario asignada; NULL = sin plantilla      |

**Validaciones**:
- `tarifa_hora > 0` (chequeado en aplicación antes de guardar; NULL es válido)

**Historial de cambios**: Registrado en `registros_auditoria` con acción `TARIFA_HORA_ACTUALIZADA`, incluyendo valor anterior y nuevo.

---

## Nueva tabla: `plantillas_horario`

```sql
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
```

| Campo                | Tipo          | Descripción                                                     |
|----------------------|---------------|-----------------------------------------------------------------|
| id                   | UUID PK       | Identificador único                                             |
| nombre               | TEXT UNIQUE   | Nombre descriptivo: "Turno Mañana", "Turno Tarde"              |
| dias_laborables      | TEXT[]        | Días activos: `['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES']` |
| hora_entrada_esperada| TIME          | Hora de entrada referencia para detectar atrasos: `07:00:00`   |
| creado_por           | UUID FK       | Administrador que creó la plantilla                             |
| creado_en            | TIMESTAMPTZ   | Timestamp de creación                                           |
| actualizado_en       | TIMESTAMPTZ   | Timestamp de última modificación                                |

**Valores válidos de `dias_laborables`**: `LUNES`, `MARTES`, `MIERCOLES`, `JUEVES`, `VIERNES`, `SABADO`, `DOMINGO`

**Validaciones**:
- `nombre` no vacío, único
- `dias_laborables` array con al menos 1 elemento, todos valores válidos
- `hora_entrada_esperada` formato HH:MM:SS válido (00:00 – 23:59)

**Regla de eliminación**: Solo puede eliminarse si `(SELECT count(*) FROM colaboradores WHERE plantilla_horario_id = id) = 0`.

---

## Tabla modificada: `dias_liquidacion`

**Sin cambio de schema**. El campo `atraso_detectado BOOLEAN DEFAULT false` ya existe.

**Cambio de comportamiento**: La función `calcularDiasDesdeEventos` en `liquidacion-db.ts` calcula `atraso_detectado = true` cuando:
- El colaborador tiene `plantilla_horario_id` asignado
- La fecha tiene su día de semana en `plantilla.dias_laborables`
- El primer evento del día ocurre después de `plantilla.hora_entrada_esperada`

---

## Tabla no modificada: `liquidaciones_semanales`

Conserva columnas `horas_ordinarias`, `horas_extra`, `valor_horas_ordinarias`, `valor_horas_extra`. Con el cálculo simplificado, `horas_extra = 0` y `valor_horas_extra = 0` siempre. Las columnas se mantienen por compatibilidad de schema.

---

## Modelo Prisma (actualizaciones)

### `packages/database/prisma/schema.prisma` y `apps/api/prisma/schema.prisma`

**Eliminar**:
- `enum TipoConfiguracion { ... }`
- `enum AplicaA { ... }`
- `model ConfiguracionRegla { ... }`
- Relación `configuraciones_reglas ConfiguracionRegla[]` en `Colaborador`
- Relación `configuraciones_creadas ConfiguracionRegla[]` en `Usuario`

**Agregar en `Colaborador`**:
```prisma
tarifa_hora           Decimal?          @db.Decimal(15, 4)
plantilla_horario_id  String?           @db.Uuid
plantilla_horario     PlantillaHorario? @relation(fields: [plantilla_horario_id], references: [id])
```

**Nuevo modelo**:
```prisma
model PlantillaHorario {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nombre                String   @unique
  dias_laborables       String[]
  hora_entrada_esperada String   @db.Time
  creado_por            String   @db.Uuid
  creado_en             DateTime @default(now()) @db.Timestamptz
  actualizado_en        DateTime @updatedAt @db.Timestamptz

  creado_por_usuario    Usuario       @relation("PlantillaCreadaPor", fields: [creado_por], references: [id])
  colaboradores         Colaborador[]

  @@map("plantillas_horario")
}
```

---

## Migración SQL

Archivo: `apps/api/prisma/migrations/20260601_008_payroll_simplification/migration.sql`

```sql
-- Step 1: Create plantillas_horario (antes de agregar la FK en colaboradores)
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

-- Step 2: Agregar columnas a colaboradores
ALTER TABLE colaboradores
  ADD COLUMN tarifa_hora          DECIMAL(15,4),
  ADD COLUMN plantilla_horario_id UUID REFERENCES plantillas_horario(id) ON DELETE SET NULL;

-- Step 3: Migrar tarifa existente desde configuraciones_reglas → colaboradores.tarifa_hora
UPDATE colaboradores c
SET tarifa_hora = sub.valor
FROM (
  SELECT DISTINCT ON (colaborador_id) colaborador_id, valor
  FROM configuraciones_reglas
  WHERE tipo = 'TARIFA_HORA'
    AND aplica_a = 'COLABORADOR'
    AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
  ORDER BY colaborador_id, vigente_desde DESC
) sub
WHERE c.id = sub.colaborador_id;

-- Step 4: Drop configuraciones_reglas y sus tipos
DROP TABLE configuraciones_reglas;
DROP TYPE IF EXISTS "TipoConfiguracion";
DROP TYPE IF EXISTS "AplicaA";
```

---

## Relaciones finales

```
PlantillaHorario ←── colaboradores (0..N)
PlantillaHorario ←── usuarios (creado_por, 1)
Colaborador ──→ PlantillaHorario (plantilla_horario_id, 0..1)
Colaborador.tarifa_hora → Decimal (campo directo, sin tabla auxiliar)
```
