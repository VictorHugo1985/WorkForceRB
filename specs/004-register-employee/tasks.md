# Tasks: Registro de Nuevo Colaborador

**Input**: `specs/004-register-employee/`
**Plan**: `specs/004-register-employee/plan.md`
**Estado**: Pendiente de implementación.

## Format: `[ID] [P?] [Story] Description`

- **[X]**: Tarea completada
- **[P]**: Puede ejecutarse en paralelo
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Migración de BD y creación de estructura de directorios

- [ ] T001 Ejecutar migración SQL en Supabase: `CREATE TABLE areas (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nombre TEXT NOT NULL UNIQUE, activo BOOLEAN NOT NULL DEFAULT true, creado_en TIMESTAMPTZ NOT NULL DEFAULT now())` y `ALTER TABLE colaboradores ADD COLUMN area_id UUID REFERENCES areas(id) ON DELETE SET NULL`
- [ ] T002 Insertar seed de áreas iniciales en Supabase: 'Producción', 'Bodega', 'Administración', 'Seguridad', 'Mantenimiento'
- [ ] T003 Crear estructura de directorios para Route Handlers: `apps/web/src/app/api/colaboradores/`, `apps/web/src/app/api/colaboradores/[id]/`, `apps/web/src/app/api/areas/`, `apps/web/src/app/api/dispositivos/`, `apps/web/src/app/api/usuarios/supervisores/`
- [ ] T004 Crear estructura de directorios para UI: `apps/web/src/app/(app)/colaboradores/nuevo/` y `apps/web/src/components/colaboradores/steps/`

---

## Phase 2: Foundational (Bloqueante para todas las historias)

**Purpose**: Helper de autorización compartido y endpoints de catálogo usados por el wizard

- [ ] T005 Agregar función `checkAdminRole(req: NextRequest): Promise<{ userId: string } | NextResponse>` en `apps/web/src/lib/auth-server.ts` — verifica JWT via `verifyToken()`, comprueba que `payload.roles` incluya `'ADMINISTRADOR'`, retorna userId o NextResponse 401/403
- [ ] T006 [P] Implementar `GET /api/areas` en `apps/web/src/app/api/areas/route.ts` — retorna `{ areas: [{id, nombre}] }` de la tabla `areas` WHERE activo = true, requiere JWT válido (checkAdminRole)
- [ ] T007 [P] Implementar `GET /api/dispositivos` en `apps/web/src/app/api/dispositivos/route.ts` — retorna `{ dispositivos: [{id, nombre, numero_serie}] }` de `dispositivos_biometricos` WHERE activo = true, requiere JWT válido
- [ ] T008 [P] Implementar `GET /api/usuarios/supervisores` en `apps/web/src/app/api/usuarios/supervisores/route.ts` — retorna `{ supervisores: [{id, nombre, apellido}] }` de `usuarios` JOIN `usuario_roles` WHERE rol IN ('ADMINISTRADOR','SUPERVISOR') AND activo = true, requiere JWT

**Checkpoint**: ✅ Foundation lista — las tres historias de usuario pueden implementarse.

---

## Phase 3: User Story 1 — Registro Completo (Priority: P1) 🎯 MVP

**Goal**: El admin completa el wizard de 6 pasos → el colaborador queda activo e inmediatamente resoluble para eventos biométricos.

**Independent Test**: `curl -b /tmp/cookies.txt -X POST .../api/colaboradores -d '{...datos completos...}'` → HTTP 201 con `{ colaborador: {...}, warnings: [] }`. Verificar en BD: colaborador activo, configuraciones_reglas, codigos_colaborador, registros_auditoria.

### Implementación US1

#### Backend

- [ ] T009 [US1] Implementar `POST /api/colaboradores` en `apps/web/src/app/api/colaboradores/route.ts` — validación Zod de campos obligatorios (nombre, apellido, cedula, area_id): retornar 400 con `{ error: "VALIDATION_ERROR", fields: {...} }` si fallan
- [ ] T010 [US1] Implementar lógica de inserción en `POST /api/colaboradores/route.ts`:
  - INSERT INTO colaboradores (nombre, apellido, cedula, area_id, supervisor_id) — si falla, retornar error
  - Si tarifa_hora: INSERT INTO configuraciones_reglas (tipo='TARIFA_HORA', aplica_a='COLABORADOR', colaborador_id, valor, unidad='COP', vigente_desde=hoy) — best-effort: errores a warnings[]
  - Si umbral_horas_extra: INSERT INTO configuraciones_reglas (tipo='UMBRAL_HORA_EXTRA', aplica_a='COLABORADOR', colaborador_id, valor, unidad='horas', vigente_desde=hoy) — best-effort
  - Si codigo_biometrico: INSERT INTO codigos_colaborador (colaborador_id, dispositivo_id, codigo_biometrico) — best-effort: PG 23505 → warning
  - Retornar HTTP 201 `{ colaborador, configuraciones_creadas, codigo_biometrico_creado, warnings }`
- [ ] T011 [US1] Implementar audit log en `POST /api/colaboradores/route.ts` — tras crear colaborador: INSERT INTO registros_auditoria (accion='COLABORADOR_REGISTRADO', entidad_tipo='Colaborador', entidad_id, usuario_id, datos_nuevos=JSON del colaborador creado, descripcion) — best-effort

#### Frontend — Wizard

- [ ] T012 [US1] Crear componente `RegistroWizard.tsx` en `apps/web/src/components/colaboradores/RegistroWizard.tsx` — MUI `<Stepper>` con 6 pasos, `useForm` de React Hook Form con `FormProvider`, estado `activeStep`, botones "Anterior"/"Siguiente"/"Confirmar", manejo de loading y errores globales
- [ ] T013 [P] [US1] Implementar `Step1DatosPersonales.tsx` en `apps/web/src/components/colaboradores/steps/` — campos nombre (required), apellido (required), cedula (required), validación Zod inline, usa `useFormContext()`
- [ ] T014 [P] [US1] Implementar `Step2AreaSupervisor.tsx` en `apps/web/src/components/colaboradores/steps/` — MUI `<Select>` para area_id (required, carga GET /api/areas al montar), MUI `<Select>` para supervisor_id (optional, carga GET /api/usuarios/supervisores), validación Zod
- [ ] T015 [P] [US1] Implementar `Step3Tarifa.tsx` en `apps/web/src/components/colaboradores/steps/` — campo tarifa_hora opcional (número COP), texto aclaratorio "Si no se configura, se usará la tarifa global vigente al liquidar"
- [ ] T016 [P] [US1] Implementar `Step4Horario.tsx` en `apps/web/src/components/colaboradores/steps/` — campo umbral_horas_extra opcional (horas decimales), texto "Si no se configura, se hereda la configuración global"
- [ ] T017 [P] [US1] Implementar `Step5CodigoBiometrico.tsx` en `apps/web/src/components/colaboradores/steps/` — MUI `<Select>` para dispositivo_id (carga GET /api/dispositivos), campo workno (string), ambos opcionales; si no hay dispositivos registrados mostrar advertencia
- [ ] T018 [US1] Implementar `Step6Confirmacion.tsx` en `apps/web/src/components/colaboradores/steps/` — tabla resumen de todos los campos capturados en los pasos 1-5; botón "Confirmar registro" que llama a POST /api/colaboradores con todos los datos; si 201 con warnings[] mostrar MUI `<Alert severity="warning">` por cada warning; si error mostrar `<Alert severity="error">`
- [ ] T019 [US1] Crear página `apps/web/src/app/(app)/colaboradores/nuevo/page.tsx` — renderiza `<RegistroWizard />`, título "Registrar Nuevo Colaborador", breadcrumb de navegación
- [ ] T020 [US1] Conectar `Step6Confirmacion.tsx` al resultado de la API — si HTTP 201 exitoso (sin warnings críticos): redirigir a `/colaboradores/<id>` (perfil del colaborador creado)

**Checkpoint**: ✅ US1 completa — el admin puede registrar un colaborador completo desde el wizard y el evento biométrico se resuelve inmediatamente.

---

## Phase 4: User Story 2 — Validación de Unicidad (Priority: P2)

**Goal**: Cédula duplicada y workno duplicado son rechazados con mensajes claros.

**Independent Test**: POST con cedula existente → HTTP 409 `{error: "DUPLICATE_CEDULA"}`. POST con workno+dispositivo ya asignado → HTTP 201 con `warnings[0]` describiendo el conflicto.

### Implementación US2

- [ ] T021 [US2] Implementar detección de cédula duplicada en `apps/web/src/app/api/colaboradores/route.ts` — antes del INSERT: `SELECT id FROM colaboradores WHERE cedula = $1` (sin filtro activo); si existe retornar HTTP 409 `{ error: "DUPLICATE_CEDULA", message: "Ya existe un colaborador con la cédula ingresada." }`
- [ ] T022 [US2] Manejar error PG `23505` en la inserción de `codigos_colaborador` en `route.ts` — capturar `err.code === '23505'` y añadir a `warnings[]`: `"Código biométrico no asignado: workno '{workno}' ya está activo en el dispositivo seleccionado."` en lugar de propagar el error
- [ ] T023 [US2] Mostrar error de cédula duplicada en el wizard — en `RegistroWizard.tsx` o `Step1DatosPersonales.tsx`: si la API retorna 409, volver al paso 1 y mostrar `<Alert severity="error">` con el mensaje de DUPLICATE_CEDULA

**Checkpoint**: ✅ US2 completa — intentos duplicados son rechazados con mensajes comprensibles.

---

## Phase 5: User Story 3 — Verificación del Perfil (Priority: P3)

**Goal**: Tras el registro, el admin puede consultar el perfil completo del colaborador recién creado.

**Independent Test**: `GET /api/colaboradores/<id>` → HTTP 200 con todos los campos: área, supervisor, tarifa vigente, horario vigente, códigos biométricos activos.

### Implementación US3

- [ ] T024 [US3] Implementar `GET /api/colaboradores/[id]` en `apps/web/src/app/api/colaboradores/[id]/route.ts` — query con JOINs: colaboradores + areas + (supervisor via usuarios) + configuraciones_reglas vigentes (TARIFA_HORA + UMBRAL_HORA_EXTRA, aplica_a=COLABORADOR, vigente_hasta IS NULL ORDER BY vigente_desde DESC LIMIT 1) + codigos_colaborador activos JOIN dispositivos_biometricos; retornar perfil completo según contrato
- [ ] T025 [US3] Crear componente `ColaboradorPerfil.tsx` en `apps/web/src/components/colaboradores/ColaboradorPerfil.tsx` — muestra: nombre completo, cédula, área, supervisor (si aplica), tarifa vigente (con fecha inicio o "Hereda global"), horario vigente (o "Hereda global"), códigos biométricos activos (tabla con dispositivo y workno)
- [ ] T026 [US3] Crear página `apps/web/src/app/(app)/colaboradores/[id]/page.tsx` — carga `GET /api/colaboradores/[id]` y renderiza `<ColaboradorPerfil />`; mostrar skeleton MUI mientras carga

**Checkpoint**: ✅ US3 completa — el admin puede verificar el perfil completo inmediatamente tras el registro.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Navegación, experiencia de usuario y validación en producción

- [ ] T027 [P] Agregar link "Registrar colaborador" en la navegación de administración (`apps/web/src/app/(app)/layout.tsx` o componente de navegación existente) — apunta a `/colaboradores/nuevo`
- [ ] T028 Verificar los 6 escenarios del `quickstart.md` contra el endpoint en producción `https://jornalero.vercel.app`

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Phase 1 (Setup)**: Sin dependencias — ejecutar primero
- **Phase 2 (Foundational)**: Depende de Phase 1 (T001 migración BD debe completarse antes de T005-T008)
- **Phases 3, 4, 5**: Dependen de Phase 2 completa
- **Phase 6 (Polish)**: Depende de US1, US2, US3 completas

### Dependencias dentro de US1

- T009, T010, T011 (backend): secuenciales en el mismo archivo `route.ts`
- T012 (RegistroWizard base): precede a T013-T017 (pasos del wizard)
- T013, T014, T015, T016, T017: paralelos entre sí (archivos distintos)
- T018 (Step6Confirmacion): después de T013-T017 (usa datos de todos los pasos)
- T019 (página): después de T012
- T020 (redirect): después de T018 y T019

### Oportunidades de paralelismo

- T006, T007, T008 (GET endpoints): paralelos — archivos distintos
- T013, T014, T015, T016, T017 (pasos wizard 1-5): paralelos — archivos distintos

---

## Parallel Example: Phase 2 (Foundational)

```bash
# T006, T007, T008 son independientes — ejecutar juntos:
Task: "Implementar GET /api/areas en apps/web/src/app/api/areas/route.ts"
Task: "Implementar GET /api/dispositivos en apps/web/src/app/api/dispositivos/route.ts"
Task: "Implementar GET /api/usuarios/supervisores en apps/web/src/app/api/usuarios/supervisores/route.ts"
```

## Parallel Example: Phase 3 US1 (Pasos del wizard)

```bash
# T013-T017 son independientes — ejecutar juntos después de T012:
Task: "Implementar Step1DatosPersonales.tsx"
Task: "Implementar Step2AreaSupervisor.tsx"
Task: "Implementar Step3Tarifa.tsx"
Task: "Implementar Step4Horario.tsx"
Task: "Implementar Step5CodigoBiometrico.tsx"
```

---

## Implementation Strategy

### Estado actual

- ⬜ Phase 1: Setup — migración BD y directorios
- ⬜ Phase 2: Foundational — helper auth + endpoints catálogo
- ⬜ Phase 3 (US1): Registro completo — backend + wizard
- ⬜ Phase 4 (US2): Validación unicidad
- ⬜ Phase 5 (US3): Perfil del colaborador
- ⬜ Phase 6: Polish

### Próximos pasos recomendados (MVP)

1. Ejecutar T001-T002 (migración SQL en Supabase)
2. T003-T004 (directorios)
3. T005-T008 (Foundation: auth helper + GET endpoints)
4. T009-T011 (POST /api/colaboradores backend)
5. T012, luego T013-T017 en paralelo, luego T018-T020 (wizard completo)
6. **VALIDAR**: escenario 1 de quickstart.md
7. T021-T023 (US2: validaciones)
8. T024-T026 (US3: perfil)
9. T027-T028 (Polish)

---

## Notes

- [P] = puede ejecutarse en paralelo (archivos diferentes)
- [X] = completado y verificado
- T001 (migración BD) es el bloqueante más crítico — sin ella nada funciona
- No hay Prisma en `apps/web` — todas las queries usan `pg.Pool` directo
- Toda modificación a `route.ts` debe pushearse a `main` para redeploy en Vercel
- Verificar siempre en Supabase después de cada cambio de BD
