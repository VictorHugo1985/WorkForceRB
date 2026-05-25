# Implementation Plan: Diseño del Modelo de Datos Relacional del MVP

**Branch**: `003-mvp-data-model` | **Date**: 2026-05-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-mvp-data-model/spec.md`

## Summary

Diseño e implementación del esquema relacional completo del MVP para el sistema de gestión de
asistencia y nómina de Imprenta Rosa Betania. El entregable principal es el paquete
`packages/database` con el schema Prisma, migraciones reversibles y cliente TypeScript generado.
Este artefacto es el prerrequisito bloqueante de todo el desarrollo backend y frontend del proyecto.
El modelo cubre 11 entidades: 2 de acceso (Usuario, Colaborador), 3 de integración biométrica
(DispositivoBiométrico, CodigoColaborador, EventoBiométrico, EventoBiométricoDesglosado), 3 de
negocio semanal (SemanaLaboral, ConfiguracionRegla, Bono, LiquidacionSemanal) y 1 de auditoría.

## Technical Context

**Language/Version**: TypeScript 5.4 / Node.js ≥ 20 LTS

**Primary Dependencies**: Prisma ORM 5.11–5.22, pgcrypto (extensión PostgreSQL para UUID v4)

**Storage**: PostgreSQL (hosted en Supabase PaaS)

**Testing**: Vitest 1.4 (seed scripts y validación de schema)

**Target Platform**: Supabase PostgreSQL — `packages/database` en monorepo Turborepo

**Project Type**: Database schema package compartido (`packages/database`)

**Performance Goals**: Webhook ingestion ≤ 5s, settlement queries ≤ 1s para semanas de hasta
200 colaboradores, índices en claves de búsqueda frecuente (requestId, colaborador+semana)

**Constraints**: Append-only en `eventos_biometricos` y `registros_auditoria` (sin UPDATE ni
DELETE); migraciones reversibles (up/down); `webhook_secreto` cifrado en reposo; UUIDs v4
mediante pgcrypto; tipo `Decimal` para valores monetarios (nunca `Float`)

**Scale/Scope**: 50–200 colaboradores, ~1 000 marcajes/semana, 2 roles, ciclos semanales,
retención indefinida de eventos biométricos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principio | Gate | Estado |
|---|---|---|
| I. Arquitectura Basada en Datos | Este plan ES el contrato estructural del sistema | ✅ |
| II. Código Limpio y Modular | Schema en paquete aislado `packages/database`; sin duplicación | ✅ |
| III. Inmutabilidad del Registro Biométrico | `eventos_biometricos` y `registros_auditoria` append-only por diseño | ✅ |
| IV. Cálculo Determinístico | `configuraciones_reglas` versionadas con `vigente_desde`/`vigente_hasta` | ✅ |
| V. Reglas Configurables | Entidad `ConfiguracionRegla` por colaborador o global, con vigencia | ✅ |
| VI. Ciclo Semanal | Entidad `SemanaLaboral` con estado ABIERTA/CERRADA; FK en bonos y liquidaciones | ✅ |
| VII. Integración Biométrica | `DispositivoBiométrico` (WEBHOOK/CSV) + `EventoBiométrico` + `EventoBiométricoDesglosado` | ✅ |
| VIII. RBAC | `Usuario.rol`: ADMINISTRADOR / SUPERVISOR | ✅ |
| IX. Trazabilidad | `RegistroAuditoria` append-only con usuario, timestamp, motivo, datos anteriores/nuevos | ✅ |
| X. Asistencia Tiempo Real | `EventoBiométricoDesglosado` con `checktime` indexado habilita queries reactivos | ✅ |
| XI. Seguridad | `webhook_secreto` nullable (encrypted at app layer); `password_hash` nunca en texto plano | ✅ |

**Resultado**: Todos los gates pasan. Proceder con Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-mvp-data-model/
├── plan.md              ← este archivo
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1: ERD + diccionario completo
├── quickstart.md        ← Phase 1: guía de uso del paquete
└── contracts/
    └── schema.prisma    ← Phase 1: contrato Prisma completo
```

### Source Code (repository root)

```text
packages/
└── database/
    ├── prisma/
    │   ├── schema.prisma        ← fuente de verdad del schema
    │   └── migrations/          ← migraciones reversibles generadas por Prisma
    ├── src/
    │   └── index.ts             ← exporta PrismaClient + tipos generados
    └── package.json             ← nombre: @workforce/database
```

**Structure Decision**: Paquete `packages/database` dentro del monorepo Turborepo. Todos los
servicios de `apps/api` importan el cliente desde `@workforce/database`. Ningún otro paquete
define su propio acceso a base de datos.

## Complexity Tracking

> No hay violaciones a la Constitución en este plan.
