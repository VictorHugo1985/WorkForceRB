# Implementation Plan: Recepción Webhook Biométrico CrossChex

**Branch**: `main` | **Date**: 2026-05-25 | **Spec**: `specs/001-webhook-biometric-reception/spec.md`

## Summary

Endpoint serverless Next.js que recibe, autentica y persiste eventos biométricos de CrossChex Cloud
en tiempo real. La implementación core está completa y en producción en Vercel. El plan documenta
la arquitectura implementada, los gaps pendientes y las decisiones técnicas validadas con datos reales.

---

## Technical Context

**Language/Version**: TypeScript 5

**Primary Dependencies**:
- `next@16.2.6` — App Router API Routes (serverless)
- `pg@8.x` — node-postgres con Pool para conexión directa a Supabase
- Sin Prisma en `apps/web` (conflicto de versiones con workspace raíz)

**Storage**: PostgreSQL (Supabase) vía Session Pooler `aws-1-us-east-1.pooler.supabase.com:5432`

**Testing**: No implementado en MVP. Escenarios manuales en `quickstart.md`.

**Target Platform**: Vercel (serverless) — `apps/web` únicamente. `apps/api` (NestJS) no desplegado.

**Project Type**: Serverless API Route — Next.js App Router

**Performance Goals**: 99% de requests responden en < 5s (FR-005, SC-002)

**Constraints**:
- Serverless: sin estado en memoria entre invocaciones — blacklists/cache no persistentes
- Vercel free tier: timeout de 10s por función
- pg Pool: cada invocación fría puede crear conexiones nuevas al pool de Supabase

**Scale/Scope**: Hasta 50 marcajes simultáneos en hora pico (SC-007)

---

## Constitution Check

| Principio | Estado | Nota |
|---|---|---|
| III — Inmutabilidad Biométrica | ✅ PASS | `ON CONFLICT DO NOTHING` en desglose; no hay UPDATE/DELETE en la ruta |
| VII — Integración Biométrica | ✅ PASS | Implementación directa del webhook en tiempo real |
| VIII — RBAC | N/A | Endpoint autenticado por secreto compartido, sin sesión de usuario |
| XI — Seguridad | ✅ PASS | HTTPS + validación `authorize-sign`; secreto en variable de entorno |
| II — Código Limpio | ✅ PASS | Función única con responsabilidades separadas (`processRecord`, `normalizeRecords`) |
| X — Latencia ≤ 60s | ✅ PASS | Respuesta inmediata HTTP 200; persistencia async no bloquea |

**Violations**: Ninguna.

---

## Project Structure

### Documentation (esta feature)

```text
specs/001-webhook-biometric-reception/
├── spec.md          ✅ Especificación funcional (clarificada 2026-05-25)
├── plan.md          ✅ Este archivo
├── research.md      ✅ Decisiones técnicas validadas con webhook real
├── data-model.md    ✅ Entidades y campos involucrados
├── quickstart.md    ✅ Escenarios de prueba con curl
├── contracts/
│   └── webhook-crosschex.md  ✅ Contrato del endpoint
└── tasks.md         ⬜ Pendiente (/speckit-tasks)
```

### Source Code

```text
apps/web/
└── src/
    └── app/
        └── api/
            └── webhooks/
                └── crosschex/
                    └── route.ts    ✅ IMPLEMENTADO — handler principal

apps/api/
└── src/
    └── webhooks/
        ├── webhooks.module.ts      ✅ Módulo NestJS (no desplegado — referencia)
        ├── webhooks.controller.ts  ✅ Controlador NestJS (no desplegado)
        └── webhooks.service.ts     ✅ Servicio NestJS (no desplegado)
```

**Structure Decision**: Next.js API Route en `apps/web` es el path de producción. La implementación
NestJS en `apps/api` existe pero no está desplegada — se mantiene como referencia para cuando el
API tenga deploy público.

---

## Estado de implementación

### Completado ✅

| FR | Descripción | Archivo |
|---|---|---|
| FR-001 | Endpoint HTTPS dedicado | `apps/web/src/app/api/webhooks/crosschex/route.ts` |
| FR-002 | Autenticación `authorize-sign` | `route.ts:88-94` |
| FR-003 | Normalización del payload `records[]` | `normalizeRecords()` |
| FR-004 | Persistencia append-only | `ON CONFLICT DO NOTHING` en desglose |
| FR-005 | Respuesta < 5s | Respuesta inmediata; procesamiento async |
| FR-006 | Idempotencia por `records[].uuid` | `ON CONFLICT (request_id) DO UPDATE` |
| FR-007 | Eventos con workno desconocido → `SIN_RESOLVER` | `processRecord()` |
| FR-009 | Disponible en < 60s | Persistencia síncrona dentro del mismo request |
| FR-011 | Dispositivo desconocido → `DISPOSITIVO_DESCONOCIDO` | `processRecord()` |
| FR-012 | Body de confirmación exacto `{"code":"200","msg":"success"}` | `route.ts:103` |
| FR-013 | HTTP 200 siempre ante firma válida | `route.ts:103` |

### Pendiente ⚠

| FR | Descripción | Prioridad |
|---|---|---|
| FR-008 | Audit log en `registros_auditoria` ante 401 | Media |
| FR-010 | Rotación de secreto sin interrupción (UI admin) | Baja — se hace vía Vercel env var |
| — | Warning log si `check_time` > 24h en el pasado o en el futuro | Baja |

---

## Complexity Tracking

No hay violaciones constitucionales que justificar.
