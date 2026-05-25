# Quickstart: `@workforce/database`

**Package**: `packages/database` | **Spec**: 003-mvp-data-model

Guía de configuración y uso del paquete compartido de base de datos en el monorepo.

---

## Estructura del paquete

```
packages/database/
├── prisma/
│   ├── schema.prisma        ← fuente de verdad (copiar desde contracts/schema.prisma)
│   └── migrations/          ← generado por `prisma migrate dev`
├── src/
│   └── index.ts             ← exporta PrismaClient y tipos generados
└── package.json             ← name: "@workforce/database"
```

---

## Configuración inicial

### 1. Prerrequisitos

- Node.js ≥ 20 LTS
- PostgreSQL (Supabase) con extensión `pgcrypto` habilitada (activa por defecto en Supabase)
- Variable de entorno `DATABASE_URL` con la cadena de conexión de Supabase

### 2. Variables de entorno

Crear `packages/database/.env` (no commitear):

```env
DATABASE_URL="postgresql://postgres:[password]@[host]:5432/[database]?schema=public"
```

Para obtener la URL: Supabase Dashboard → Project Settings → Database → Connection string → URI.

### 3. Instalar dependencias

```bash
# Desde la raíz del monorepo
pnpm install
```

### 4. Copiar el schema contrato

```bash
cp specs/003-mvp-data-model/contracts/schema.prisma packages/database/prisma/schema.prisma
```

### 5. Crear y aplicar la migración inicial

```bash
cd packages/database
pnpm prisma migrate dev --name init
```

Esto genera `packages/database/prisma/migrations/[timestamp]_init/migration.sql` y aplica el schema en la base de datos.

### 6. Generar el cliente Prisma

```bash
pnpm prisma generate
```

El cliente se genera en `node_modules/@prisma/client`. Turborepo cachea esta operación entre builds.

---

## `src/index.ts`

```typescript
export { PrismaClient, Prisma } from '@prisma/client';
export type {
  Usuario,
  Colaborador,
  CodigoColaborador,
  DispositivoBiometrico,
  EventoBiometrico,
  EventoBiometricoDesglosado,
  SemanaLaboral,
  ConfiguracionRegla,
  Bono,
  LiquidacionSemanal,
  RegistroAuditoria,
  Rol,
  TipoDispositivo,
  EstadoResolucion,
  EstadoSemana,
  TipoConfiguracion,
  AplicaA,
  TipoBono,
  EstadoLiquidacion,
} from '@prisma/client';
```

---

## `package.json` mínimo

```json
{
  "name": "@workforce/database",
  "version": "0.1.0",
  "main": "src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate:dev": "prisma migrate dev",
    "migrate:deploy": "prisma migrate deploy",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.11.0"
  },
  "devDependencies": {
    "prisma": "^5.11.0"
  }
}
```

---

## Uso en `apps/api`

### Importar el cliente

```typescript
import { PrismaClient } from '@workforce/database';

const prisma = new PrismaClient();
```

### Patrón recomendado: singleton por módulo NestJS

```typescript
// apps/api/src/database/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@workforce/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

### Ejemplos de queries frecuentes

**Crear evento biométrico (append-only):**
```typescript
const evento = await prisma.eventoBiometrico.create({
  data: {
    request_id: headers['requestId'],
    codigo_biometrico: body.employee.workno,
    payload_completo: body,
    estado_resolucion: 'SIN_RESOLVER',
  },
});
```

**Buscar regla vigente para una fecha (Effective Dating):**
```typescript
const regla = await prisma.configuracionRegla.findFirst({
  where: {
    tipo: 'TARIFA_HORA',
    aplica_a: 'GLOBAL',
    vigente_desde: { lte: fechaSemana },
    OR: [
      { vigente_hasta: null },
      { vigente_hasta: { gte: fechaSemana } },
    ],
  },
});
```

**Buscar liquidación única por colaborador y semana:**
```typescript
const liquidacion = await prisma.liquidacionSemanal.findUnique({
  where: {
    colaborador_id_semana_id: {
      colaborador_id: colaboradorId,
      semana_id: semanaId,
    },
  },
});
```

---

## Tablas append-only

Las siguientes tablas nunca exponen métodos `update` ni `delete` en la capa de servicio:

| Tabla | Modelo Prisma | Motivo |
|---|---|---|
| `eventos_biometricos` | `EventoBiometrico` | Registro biométrico inmutable (Principio III) |
| `eventos_biometricos_desglosados` | `EventoBiometricoDesglosado` | Desglose vinculado al evento inmutable |
| `registros_auditoria` | `RegistroAuditoria` | Log de auditoría inmutable (Principio IX) |

> Toda corrección a un marcaje biométrico se documenta con una entrada en `RegistroAuditoria`
> y un evento de ajuste explícito; nunca mediante UPDATE del registro original.

---

## Migraciones reversibles

Cada migración debe incluir una instrucción de rollback documentada en el comentario inicial del archivo SQL. Para hacer rollback:

```bash
cd packages/database
pnpm prisma migrate resolve --rolled-back [migration_name]
```

---

## `apps/web`

`apps/web` **no importa** `@workforce/database`. El frontend se comunica únicamente a través de `apps/api`. Esta restricción está definida en el Principio I de la Constitución.
