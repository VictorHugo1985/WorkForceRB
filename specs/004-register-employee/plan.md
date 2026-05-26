# Implementation Plan: Registro de Nuevo Colaborador

**Branch**: `main` | **Date**: 2026-05-25 | **Spec**: `specs/004-register-employee/spec.md`

## Summary

Wizard de 6 pasos en Next.js App Router para que el ADMINISTRADOR registre un nuevo colaborador:
datos personales, área de trabajo, supervisor (opcional), tarifa horaria (opcional), horario
laboral (opcional) y código biométrico/workno (opcional). El colaborador siempre se crea con los
campos obligatorios; los opcionales se guardan en best-effort con warnings. API en Next.js Route
Handlers (`apps/web`), UI con MUI v5 + React Hook Form + Zod.

---

## Technical Context

**Language/Version**: TypeScript 5

**Primary Dependencies**:
- `next@16.2.6` — App Router, Route Handlers (serverless)
- `pg@8.x` — node-postgres Pool (sin Prisma en `apps/web`)
- `@mui/material@5.15` + `@emotion/react` — Stepper, TextField, Select, Button
- `react-hook-form@7.x` + `zod@3.x` — validación por paso
- `jose` — verificación JWT para auth en Route Handlers
- `bcryptjs` — (ya instalado) no requerido en esta feature
- `axios` — llamadas HTTP desde el cliente

**Storage**: PostgreSQL (Supabase) vía Session Pooler `aws-1-us-east-1.pooler.supabase.com:5432`

**Data Model Amendment**:
- Nueva tabla: `areas` (catálogo de áreas de trabajo)
- Campo nuevo: `colaboradores.area_id UUID FK areas(id)`
- Ver `specs/004-register-employee/data-model.md`

**Testing**: Manual — escenarios en `quickstart.md`. Sin tests automatizados en MVP.

**Target Platform**: Vercel (serverless) — `apps/web` únicamente.

**Project Type**: Next.js App Router — Route Handlers + React UI

**Performance Goals**: Registro completo < 3 minutos (SC-001). Activación inmediata para resolución biométrica (SC-004: 0 minutos de latencia).

**Constraints**:
- Sin Prisma en `apps/web` — usar `pg.Pool` directo (misma restricción que webhook y auth)
- Vercel serverless: sin estado entre invocaciones
- El wizard envía los datos en una única solicitud al confirmar (paso 6)
- Guardado parcial: el colaborador se crea en transacción; opcionales con best-effort

**Scale/Scope**: Baja frecuencia — el admin registra colaboradores uno a uno. Sin paginación en MVP.

---

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| I — Arquitectura Basada en Datos | ✅ PASS | Nueva tabla `areas` + enmienda `area_id` — aditiva, no rompe modelo v2.0 |
| II — Código Limpio y Modular | ✅ PASS | Route Handlers separados por entidad; wizard como componente independiente |
| III — Inmutabilidad Biométrica | N/A | No modifica eventos biométricos |
| IV — Cálculo Determinístico | N/A | No implementa cálculo; solo registra tarifa para uso futuro |
| V — Reglas Configurables | ✅ PASS | Tarifa y horario almacenados en `configuraciones_reglas` con `vigente_desde` |
| VI — Ciclo Semanal | N/A | No afecta semanas laborales |
| VII — Integración Biométrica | ✅ PASS | Al asignar workno, el colaborador queda inmediatamente resoluble (SC-004) |
| VIII — RBAC | ✅ PASS | FR-001: solo ADMINISTRADOR; verificación de rol en cada Route Handler |
| IX — Trazabilidad | ✅ PASS | FR-010: `registros_auditoria` al completar registro |
| X — Latencia ≤ 60s | ✅ PASS | Resolución biométrica inmediata tras asignación de workno |
| XI — Seguridad | ✅ PASS | JWT verificado en cada endpoint; validación Zod en backend |

**Violations**: Ninguna.

---

## Project Structure

### Documentation (esta feature)

```text
specs/004-register-employee/
├── spec.md          ✅ Especificación funcional (clarificada 2026-05-25)
├── plan.md          ✅ Este archivo
├── research.md      ✅ Decisiones técnicas
├── data-model.md    ✅ Enmienda al modelo base (nueva tabla areas + area_id)
├── quickstart.md    ✅ Escenarios de prueba con curl
├── contracts/
│   └── api-colaboradores.md  ✅ Contratos de los 4 endpoints
└── tasks.md         ⬜ Pendiente (/speckit-tasks)
```

### Source Code

```text
apps/web/
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── colaboradores/
    │   │   │   ├── route.ts              ← POST /api/colaboradores
    │   │   │   └── [id]/
    │   │   │       └── route.ts          ← GET /api/colaboradores/[id]
    │   │   ├── areas/
    │   │   │   └── route.ts              ← GET /api/areas
    │   │   ├── dispositivos/
    │   │   │   └── route.ts              ← GET /api/dispositivos
    │   │   └── usuarios/
    │   │       └── supervisores/
    │   │           └── route.ts          ← GET /api/usuarios/supervisores
    │   └── (app)/
    │       └── colaboradores/
    │           └── nuevo/
    │               └── page.tsx          ← Wizard UI (6 pasos)
    ├── components/
    │   └── colaboradores/
    │       ├── RegistroWizard.tsx        ← Componente Stepper principal
    │       ├── steps/
    │       │   ├── Step1DatosPersonales.tsx
    │       │   ├── Step2AreaSupervisor.tsx
    │       │   ├── Step3Tarifa.tsx
    │       │   ├── Step4Horario.tsx
    │       │   ├── Step5CodigoBiometrico.tsx
    │       │   └── Step6Confirmacion.tsx
    │       └── ColaboradorPerfil.tsx     ← Vista de perfil (US3)
    └── lib/
        └── auth-server.ts               ← Ya existe; se reutiliza para verificar JWT
```

**Structure Decision**: Next.js Route Handlers en `apps/web` — consistente con auth y webhook en producción. UI en `(app)/colaboradores/nuevo/page.tsx` dentro del layout autenticado existente.

---

## Estado de implementación

### Pendiente ⬜

| FR | Descripción | Archivo |
|---|---|---|
| Migración BD | CREATE TABLE `areas`; ALTER TABLE `colaboradores` ADD area_id | migración SQL en Supabase |
| FR-001 | Verificación rol ADMINISTRADOR en Route Handlers | `route.ts` de cada endpoint |
| FR-002 | POST colaboradores con validación Zod obligatoria | `api/colaboradores/route.ts` |
| FR-003 | Campo supervisor_id opcional | `api/colaboradores/route.ts` |
| FR-004 | ConfiguracionRegla TARIFA_HORA opcional | `api/colaboradores/route.ts` |
| FR-005 | ConfiguracionRegla UMBRAL_HORA_EXTRA opcional | `api/colaboradores/route.ts` |
| FR-006 | CodigoColaborador opcional (best-effort) | `api/colaboradores/route.ts` |
| FR-007 | Rechazo cédula duplicada (409) | `api/colaboradores/route.ts` |
| FR-008 | Rechazo workno+dispositivo duplicado (warning parcial) | `api/colaboradores/route.ts` |
| FR-009 | Activación inmediata (sin delay) | por diseño — sin jobs asincrónicos |
| FR-010 | Audit log en `registros_auditoria` | `api/colaboradores/route.ts` |
| US1 | Wizard 6 pasos — MUI Stepper + RHF + Zod | `components/colaboradores/` |
| US2 | Mensajes de error claros en wizard | `RegistroWizard.tsx` |
| US3 | Vista de perfil del colaborador | `api/colaboradores/[id]/route.ts` + `ColaboradorPerfil.tsx` |
| Dropdowns | GET áreas, supervisores, dispositivos | `api/areas/`, `api/usuarios/supervisores/`, `api/dispositivos/` |

---

## Decisiones técnicas clave

### Guardado parcial vs. transacción atómica

El wizard envía todos los datos en una sola request al paso 6. El Route Handler:

1. Inserta `colaboradores` (campos obligatorios) — si falla, retorna 400/409.
2. Inserta `configuraciones_reglas` para tarifa y/o horario — best-effort; los errores van a `warnings[]`.
3. Inserta `codigos_colaborador` — best-effort; error de unicidad (PG 23505) → warning en lugar de 500.
4. Inserta `registros_auditoria` — best-effort; no bloquea la respuesta.
5. Retorna HTTP 201 con el colaborador creado + `warnings[]`.

El colaborador nunca queda en estado "a medias" por el paso 1 — o existe completo con sus campos obligatorios, o no existe.

### Herencia de tarifa global

Esta feature no implementa el motor de cálculo. Solo garantiza que:
- Si el admin configura tarifa: `ConfiguracionRegla { tipo: TARIFA_HORA, aplica_a: COLABORADOR, colaborador_id: X }`
- Si no: no se crea ningún registro; el motor futuro buscará `aplica_a: GLOBAL` al liquidar.

### Enmienda al modelo de datos

La migración SQL se aplica en Supabase vía el dashboard o `psql`. No hay Prisma migrations en `apps/web`. El campo `area_id` es nullable en BD para compatibilidad con registros existentes; la validación obligatoria se enforza solo en el API Route de creación.

---

## Complexity Tracking

No hay violaciones constitucionales que justificar. La enmienda al modelo (nueva tabla `areas`) es aditiva y no requiere aprobación formal dado que es una extensión modular (Principio I).

---

## Próximos pasos

1. Ejecutar migración SQL en Supabase (tabla `areas` + campo `area_id`)
2. Correr `/speckit-tasks` para generar el task breakdown
3. Correr `/speckit-implement` para implementar
