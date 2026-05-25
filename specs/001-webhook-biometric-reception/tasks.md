# Tasks: Recepción Webhook Biométrico CrossChex Cloud

**Input**: `specs/001-webhook-biometric-reception/`
**Plan**: `specs/001-webhook-biometric-reception/plan.md`
**Estado**: Implementación core completa en producción (2026-05-25). Tareas pendientes son gaps menores.

## Format: `[ID] [P?] [Story] Description`

- **[X]**: Tarea completada
- **[P]**: Puede ejecutarse en paralelo
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Configuración inicial del endpoint y variables de entorno

- [X] T001 Crear Next.js API Route en `apps/web/src/app/api/webhooks/crosschex/route.ts`
- [X] T002 Instalar dependencia `pg` y `@types/pg` en `apps/web/package.json`
- [X] T003 Configurar variable de entorno `DATABASE_URL` en Vercel
- [X] T004 Configurar variable de entorno `CROSSCHEX_WEBHOOK_SECRET` en Vercel
- [X] T005 Excluir rutas `/api/` del chequeo de autenticación en `apps/web/middleware.ts`
- [X] T006 Registrar dispositivo W1PRO (S/N: 0680200024340009) en `dispositivos_biometricos`

---

## Phase 2: Foundational (Bloqueante para todas las historias)

**Purpose**: Pool de BD y normalización del payload CrossChex Cloud

- [X] T007 Implementar `pg.Pool` con `DATABASE_URL` en `route.ts`
- [X] T008 Implementar `normalizeRecords(body)` para extraer `body.records[]` en `route.ts`
- [X] T009 Implementar `processRecord(record, fallbackId)` con resolución de dispositivo y colaborador en `route.ts`
- [X] T010 Implementar `derivarTipoEvento(record)` mapeando `check_type` 0→ENTRADA, 1→SALIDA en `route.ts`
- [X] T011 Implementar conversión de timezone UTC→GMT-4 (`toGMTMinus4`) en `route.ts`

**Checkpoint**: ✅ Foundation lista — las tres historias de usuario pueden implementarse.

---

## Phase 3: User Story 1 — Recepción Exitosa (Priority: P1) 🎯 MVP

**Goal**: CrossChex envía un evento válido → el sistema lo autentica, persiste y responde 200 en < 5s.

**Independent Test**: `curl -X POST .../api/webhooks/crosschex -H "authorize-sign: SECRET" -d '{"records":[{...}]}'` → responde `{"code":"200","msg":"success"}` y el evento aparece en `eventos_biometricos` + `eventos_biometricos_desglosados`.

### Implementación US1

- [X] T012 [US1] Validar header `authorize-sign` y retornar 401 si inválido en `route.ts`
- [X] T013 [US1] Upsert `eventos_biometricos` con `ON CONFLICT (request_id)` para idempotencia en `route.ts`
- [X] T014 [US1] Insert `eventos_biometricos_desglosados` con `ON CONFLICT (evento_id) DO NOTHING` en `route.ts`
- [X] T015 [US1] Retornar `{"code":"200","msg":"success"}` siempre ante firma válida en `route.ts`
- [X] T016 [US1] Procesar múltiples records con `Promise.allSettled` en `route.ts`
- [X] T017 [US1] Almacenar `payload_completo` como JSONB del record individual en `route.ts`

**Checkpoint**: ✅ US1 completa — validado con primer webhook real recibido el 2026-05-25.

---

## Phase 4: User Story 2 — Rechazo de No Autorizadas (Priority: P2)

**Goal**: Solicitudes sin firma o con firma incorrecta son rechazadas; el intento queda en auditoría.

**Independent Test**: `curl -X POST .../api/webhooks/crosschex` (sin header) → HTTP 401. Verificar que no se crea ningún registro en `eventos_biometricos`. Verificar entrada en `registros_auditoria`.

### Implementación US2

- [X] T018 [US2] Retornar HTTP 401 `{"code":"401","msg":"unauthorized"}` ante firma ausente o inválida en `route.ts`
- [ ] T019 [US2] Agregar audit log en `registros_auditoria` al rechazar con 401 (FR-008) en `route.ts`

**T019 — Detalle de implementación**:
```typescript
// En el bloque de validación de authorize-sign (route.ts, antes del return 401):
const client = await pool.connect();
try {
  await client.query(
    `INSERT INTO registros_auditoria (accion, descripcion, ip_origen)
     VALUES ('WEBHOOK_ACCESO_NO_AUTORIZADO', 'authorize-sign inválido o ausente', $1)`,
    [req.headers.get('x-forwarded-for') ?? null],
  );
} catch { /* no bloquear la respuesta por fallo de audit */ } finally { client.release(); }
```

**Checkpoint**: US2 completa cuando T019 esté implementado y verificado.

---

## Phase 5: User Story 3 — Preservación de Desconocidos (Priority: P3)

**Goal**: Eventos con workno o dispositivo no registrado se preservan con estado correcto.

**Independent Test**: Enviar evento con `serial_number` no registrado → `estado_resolucion = DISPOSITIVO_DESCONOCIDO`. Enviar evento con workno desconocido (dispositivo sí registrado) → `estado_resolucion = SIN_RESOLVER`.

### Implementación US3

- [X] T020 [US3] Resolver `dispositivo_id` por `numero_serie` en `dispositivos_biometricos` en `route.ts`
- [X] T021 [US3] Resolver `colaborador_id` por `codigo_biometrico` en `codigos_colaborador` en `route.ts`
- [X] T022 [US3] Asignar `estado_resolucion` según combinación dispositivo/colaborador en `route.ts`
- [X] T023 [US3] Persistir eventos con `codigo_biometrico` vacío o desconocido sin rechazarlos en `route.ts`

**Checkpoint**: ✅ US3 completa — validado con primer webhook real (estado `SIN_RESOLVER` para workno 5327643 no asociado).

*Nota: La visualización admin de eventos "sin resolver" es una feature separada (fuera del alcance de spec 001).*

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Gaps menores de robustez y observabilidad

- [ ] T024 [P] Agregar warning log cuando `check_time` está más de 24h en el pasado o en el futuro en `apps/web/src/app/api/webhooks/crosschex/route.ts`
- [ ] T025 [P] Agregar log de error estructurado (incluir `requestId`, `serialNumber`, mensaje) en el `catch` de `processRecord` en `route.ts`
- [X] T026 Verificar escenarios del `quickstart.md` contra el endpoint en producción `https://jornalero.vercel.app/api/webhooks/crosschex`

**T024 — Detalle de implementación**:
```typescript
// En processRecord(), después de parsear checktime:
const checktimeMs = new Date(checktime).getTime();
const nowMs = Date.now();
const diff = Math.abs(nowMs - checktimeMs);
if (diff > 24 * 60 * 60 * 1000) {
  console.warn('[crosschex-webhook] timestamp fuera de rango', { requestId, checktime, diffHours: diff / 3600000 });
}
```

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Phase 1 (Setup)**: Sin dependencias — ✅ completada
- **Phase 2 (Foundational)**: Depende de Phase 1 — ✅ completada
- **Phases 3, 4, 5**: Dependen de Phase 2 — US1 y US3 ✅; US2 tiene T019 pendiente
- **Phase 6 (Polish)**: Depende de US1 completada — T024, T025 pueden ejecutarse en paralelo

### Oportunidades de paralelismo

- T019 y T024/T025 pueden ejecutarse en paralelo (archivos distintos no, pero mismo archivo — ejecutar secuencialmente)
- T024 y T025 pueden ejecutarse en paralelo (ambos son modificaciones independientes al mismo bloque de `route.ts`)

---

## Parallel Example: Phase 6 Polish

```bash
# T024 y T025 modifican route.ts — ejecutar secuencialmente:
Task: "Agregar warning log de timestamp fuera de rango en route.ts"
Task: "Mejorar log de error estructurado en catch de processRecord en route.ts"
```

---

## Implementation Strategy

### Estado actual (MVP validado en producción)

- ✅ Phase 1: Setup — completa
- ✅ Phase 2: Foundational — completa
- ✅ Phase 3 (US1): Recepción exitosa — completa y en producción
- ⚠️ Phase 4 (US2): Falta T019 (audit log de 401)
- ✅ Phase 5 (US3): Preservación de desconocidos — completa
- ⬜ Phase 6 (Polish): T024, T025 pendientes

### Próximos pasos recomendados

1. Implementar T019 (audit log de accesos no autorizados) — cierra FR-008
2. Implementar T024 + T025 en paralelo — mejora observabilidad
3. Ejecutar quickstart.md completo para validar los 4 escenarios

---

## Notes

- [P] = puede ejecutarse en paralelo (archivos diferentes o bloques independientes)
- [X] = completado y verificado en producción
- Toda modificación a `route.ts` debe ser seguida de un push a `main` para redeploy en Vercel
- Verificar siempre en Supabase después de cada cambio en producción
