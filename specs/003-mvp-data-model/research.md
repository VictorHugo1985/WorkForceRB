# Research: Diseño del Modelo de Datos Relacional del MVP

**Feature**: 003-mvp-data-model | **Date**: 2026-05-22

---

## 1. Append-Only Tables en Prisma / PostgreSQL

**Decision**: Enforced at application layer (no triggers DB-side) para mantener compatibilidad
con Prisma migrations. El servicio NestJS nunca expone métodos `update` ni `delete` para
`EventoBiometrico` ni `RegistroAuditoria`.

**Rationale**: Prisma no soporta constraints `RULE`/`TRIGGER` nativos en el schema DSL.
La alternativa (trigger SQL) requeriría migrations raw que complican el flujo up/down.
El enforcement a nivel de servicio es suficiente dado que el único punto de escritura es la API.

**Alternatives considered**:
- PostgreSQL RULE: descartado — no compatible con migraciones Prisma autogeneradas.
- Row-level security en Supabase: viable pero agrega complejidad de rol de BD fuera del scope MVP.

---

## 2. Valores Monetarios — Decimal vs Float

**Decision**: `Decimal(15,2)` para todos los valores monetarios (monto, valor_horas, total_pago).
`Decimal(15,4)` para tarifas y configuraciones de reglas (mayor precisión para divisiones).

**Rationale**: `Float` introduce errores de representación binaria (ej. 3.30 → 3.2999999...).
Para nómina, un centavo de diferencia por colaborador a escala de semanas tiene impacto real.
PostgreSQL `NUMERIC`/`DECIMAL` es exacto. Prisma mapea `Decimal` → `NUMERIC` en Postgres.

**Alternatives considered**: `Int` (centavos): evita flotantes pero dificulta la lectura y
requiere conversión en toda la capa de presentación. Descartado por complejidad.

---

## 3. UUIDs v4 con pgcrypto

**Decision**: `@default(dbgenerated("gen_random_uuid()"))` con extensión `pgcrypto` habilitada
en Supabase. Tipo `@db.Uuid` en Prisma.

**Rationale**: Supabase habilita `pgcrypto` por defecto. `gen_random_uuid()` genera UUIDs v4
criptográficamente seguros en la base de datos sin depender del runtime de Node.js. Los IDs no
son predecibles ni secuenciales, lo que reduce la exposición de información en URLs.

**Alternatives considered**: `cuid2` generado en Node.js: portable pero rompe el principio de
que la BD genera sus propias claves. `autoincrement`: expone volumen de registros en IDs.

---

## 4. Reglas de Negocio Versionadas (Temporal Pattern)

**Decision**: Entidad `ConfiguracionRegla` con campos `vigente_desde: Date` y
`vigente_hasta: Date?` (null = vigente indefinidamente). Para calcular una semana histórica,
se busca la regla con `vigente_desde <= fecha_semana AND (vigente_hasta IS NULL OR vigente_hasta >= fecha_semana)`.

**Rationale**: Patrón "Effective Dating" — estándar en sistemas de nómina. Permite recalcular
cualquier semana pasada usando la configuración que estaba vigente en ese momento, cumpliendo el
Principio IV (Cálculo Determinístico).

**Alternatives considered**: Event sourcing completo: excesivo para el scope MVP. Versionado
por número: no permite consulta temporal directa sin join adicional.

---

## 5. Relación EventoBiométrico ↔ EventoBiométricoDesglosado

**Decision**: Relación 1:1 opcional. `EventoBiometrico` almacena el payload raw completo
(JSON) y es el registro inmutable de recepción. `EventoBiometricoDesglosado` almacena los
campos parseados en columnas individuales para queries eficientes. El desglose se crea al
procesar el evento; puede no existir si el payload era inválido.

**Rationale**: Separar recepción de procesamiento cumple el Principio III (el evento original
es inmutable) mientras permite indexar `checktime`, `employee_workno` y `device_serial_number`
sin necesidad de extracción JSON en cada query.

**Alternatives considered**: Columnas generadas (GENERATED ALWAYS AS): no soportadas por Prisma
ORM en versión actual para campos JSON. Todo en una tabla con campos nullable: mezcla
responsabilidades de recepción y procesamiento.

---

## 6. Estructura del Paquete `packages/database`

**Decision**:
```
packages/database/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   └── index.ts       # export { PrismaClient } from '@prisma/client'
└── package.json       # name: "@workforce/database"
```

`apps/api` importa: `import { PrismaClient } from '@workforce/database'`

**Rationale**: Centraliza el schema en un único paquete. Turborepo cachea la generación del
cliente Prisma. `apps/web` no importa este paquete (solo `apps/api` accede a la BD directamente).

---

## 7. Índices Recomendados

| Tabla | Columnas | Justificación |
|---|---|---|
| `eventos_biometricos` | `request_id` | Deduplicación idempotente (UNIQUE) |
| `eventos_biometricos` | `colaborador_id, recibido_en` | Queries de asistencia por colaborador |
| `eventos_biometricos` | `estado_resolucion` | Filtrar eventos sin resolver |
| `eventos_biometricos_desglosados` | `checktime` | Vista en tiempo real por fecha |
| `eventos_biometricos_desglosados` | `employee_workno` | Resolución de código a colaborador |
| `configuraciones_reglas` | `tipo, vigente_desde, vigente_hasta` | Lookup de regla vigente |
| `liquidaciones_semanales` | `colaborador_id, semana_id` | UNIQUE, lookup principal |
| `semanas_laborales` | `estado` | Filtrar semana activa |
