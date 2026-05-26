# Implementation Plan: Visualizador de Eventos Biométricos

**Branch**: `013-biometric-events-view` | **Date**: 2026-05-26 | **Spec**: [spec.md](spec.md)

**Input**: `specs/013-biometric-events-view/spec.md`

---

## Summary

Implementar una vista de consulta de eventos biométricos (marcaciones de entrada/salida)
accesible desde el sidebar para roles ADMINISTRADOR y SUPERVISOR. La vista permite filtrar
por fecha, colaborador, tipo de evento, dispositivo y estado de resolución, con paginación
server-side. Sin cambios al esquema de base de datos — solo lectura sobre tablas existentes.

---

## Technical Context

**Language/Version**: TypeScript 5.x + Next.js 16 (App Router)

**Primary Dependencies**:
- MUI v9 (ya instalado) — `Table`, `TablePagination`, `Select`, `TextField`, `Chip`
- `pg.Pool` (ya instalado) — queries SQL directas sobre PostgreSQL
- Sin dependencias nuevas

**Storage**: PostgreSQL (Supabase) — lectura de `eventos_biometricos`,
`eventos_biometricos_desglosados`, `colaboradores`, `dispositivos_biometricos`

**Testing**: Sin test runner en `apps/web`. Validación via quickstart.md (12 escenarios)

**Target Platform**: Vercel (Node.js runtime para API route + Client Component en browser)

**Performance Goals**: Resultados en < 3 segundos para rangos de hasta 30 días (SC-001)

**Constraints**:
- Sin cambios al esquema de base de datos (sólo lectura)
- Sin dependencias nuevas — usar solo MUI v9 ya instalado y `<input type="date">` nativo
- Filtro de dispositivos: endpoint `/api/dispositivos` existente requiere ADMINISTRADOR.
  El Server Component lo carga al renderizar la página. Si falla (SUPERVISOR), el filtro
  de dispositivo queda vacío pero la vista sigue funcional.

**Scale/Scope**: ~4 archivos nuevos + 1 modificado (`nav-config.ts`)

---

## Constitution Check

| Principio | Estado | Justificación |
|-----------|--------|---------------|
| I. Arquitectura Basada en Datos | ✅ PASS | Sin cambios de BD. Lectura de tablas existentes. |
| II. Código Limpio y Crecimiento Modular | ✅ PASS | Nuevos archivos sin modificar código existente (salvo nav-config.ts). |
| III. Inmutabilidad Biométrica | ✅ PASS | Solo lectura — ningún evento se modifica ni elimina. |
| IV. Cálculo Determinístico | ✅ PASS | No aplica — feature de consulta. |
| V. Reglas Configurables | ✅ PASS | No aplica — feature de consulta. |
| VI. Ciclo Semanal | ✅ PASS | No aplica. |
| VII. Integración Biométrica | ✅ PASS | Exposición de datos ya capturados por spec 001. |
| VIII. RBAC | ✅ PASS | Solo ADMINISTRADOR + SUPERVISOR. Verificación en API route y proxy.ts. |
| IX. Trazabilidad | ✅ PASS | No aplica — lectura sin escritura. |
| X. Disponibilidad en Tiempo Real | ✅ PASS | Vista histórica bajo demanda — "las vistas históricas cerradas pueden ser batch" (Principio X). SC-001 exige < 3 segundos. |
| XI. Seguridad | ✅ PASS | Auth verificada en proxy.ts + API route. Solo HTTPS en producción. |
| Responsive | ✅ PASS | SC-005 especifica funcionalidad desde 375px. |

**Veredicto**: Sin violaciones. Puede proceder a implementación.

---

## Project Structure

### Documentation (this feature)

```text
specs/013-biometric-events-view/
├── plan.md              ← este archivo
├── research.md          ← D1–D8 decisiones técnicas
├── data-model.md        ← tablas consultadas + query SQL
├── contracts/
│   └── api-eventos.md   ← contrato del API endpoint y UI component
├── quickstart.md        ← 12 escenarios de verificación
└── tasks.md             ← generado por /speckit-tasks
```

### Source Code

```text
apps/web/src/
├── lib/
│   └── nav-config.ts                              # MODIFICADO — agregar /eventos
├── app/
│   ├── api/
│   │   └── eventos-biometricos/
│   │       └── route.ts                           # NUEVO — GET con filtros + paginación
│   └── (app)/
│       └── eventos/
│           ├── page.tsx                           # NUEVO — Server Component
│           └── EventosClient.tsx                  # NUEVO — Client Component (filtros + tabla)
```

---

## Implementation Decisions

### Decisión 1: nav-config.ts — agregar /eventos

```typescript
// Agregar a NAV_ITEMS:
{ label: 'Eventos Biométricos', href: '/eventos', roles: ['ADMINISTRADOR', 'SUPERVISOR'] }

// Agregar a ROUTE_ROLES:
'/eventos': ['ADMINISTRADOR', 'SUPERVISOR']
```

### Decisión 2: API route — autorización multi-rol

```typescript
// apps/web/src/app/api/eventos-biometricos/route.ts
export async function GET(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  if (!token) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  let payload: AuthPayload;
  try { payload = await verifyToken(token); }
  catch { return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }); }

  if (isBlacklisted(payload.jti)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const ALLOWED = ['ADMINISTRADOR', 'SUPERVISOR'];
  if (!payload.roles.some(r => ALLOWED.includes(r))) {
    return NextResponse.json({ error: 'FORBIDDEN', required_roles: ALLOWED }, { status: 403 });
  }
  // ... resto de la lógica
}
```

### Decisión 3: Filtro de fecha — timezone GMT-4

```typescript
// En el API route, convertir fecha string a rango UTC para la query
function buildDateRange(fecha_desde: string, fecha_hasta: string) {
  // Tratar las fechas como GMT-4 (Venezuela: UTC-4)
  // fecha_desde = "2026-05-26" → "2026-05-26T00:00:00-04:00"
  // fecha_hasta = "2026-05-26" → "2026-05-27T00:00:00-04:00" (exclusive)
  const desde = new Date(`${fecha_desde}T00:00:00-04:00`);
  const hasta = new Date(`${fecha_hasta}T00:00:00-04:00`);
  hasta.setDate(hasta.getDate() + 1); // exclusivo
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}
```

### Decisión 4: Valor por defecto de fechas en el cliente

```typescript
// En EventosClient.tsx
function todayGMTMinus4(): string {
  // Calcular la fecha actual en GMT-4
  const now = new Date();
  const offset = -4 * 60; // minutos
  const local = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  return local.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

const [filtros, setFiltros] = useState({
  fecha_desde: todayGMTMinus4(),
  fecha_hasta: todayGMTMinus4(),
  // ... resto
});
```

### Decisión 5: Chips de color para tipo y estado

```typescript
// Tipo de evento
const TIPO_COLORS = {
  ENTRADA: 'success',
  SALIDA: 'warning',
  DESCONOCIDO: 'default',
} as const;

// Estado de resolución
const ESTADO_COLORS = {
  RESUELTO: 'success',
  SIN_RESOLVER: 'warning',
  DISPOSITIVO_DESCONOCIDO: 'error',
} as const;
```

### Decisión 6: Carga de dispositivos para el filtro

```typescript
// En page.tsx (Server Component) — precarga dispositivos para el filtro
async function getDispositivos() {
  // Los dispositivos se cargan en el servidor con las credenciales del token
  // Si el usuario es SUPERVISOR y el endpoint retorna 403, devuelve []
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/dispositivos`, {
      headers: { cookie: `access_token=${token}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.dispositivos ?? [];
  } catch { return []; }
}
```

---

## Dependencies

- **spec 001**: Webhook biométrico — tablas `eventos_biometricos` + `eventos_biometricos_desglosados` ✅ implementado
- **spec 004**: Tabla `colaboradores` ✅ implementado
- **spec 012**: Sidebar y nav-config.ts — agregar entrada `/eventos` ✅ implementado (se modifica)
- Sin dependencias de nuevas migraciones

## Out of Scope

- Exportar a CSV / Excel (iteración futura)
- Edición de eventos desde la vista (spec 001 — inmutabilidad biométrica)
- Vista en tiempo real / streaming (vistas históricas son batch per Principio X)
- Gráficas o estadísticas de asistencia (feature separada)
- Resolución manual de eventos SIN_RESOLVER (feature separada)
