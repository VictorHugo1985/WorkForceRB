# Research: Visualizador de Eventos Biométricos

**Feature**: 013-biometric-events-view | **Date**: 2026-05-26

---

## D1 — Acceso a datos: pg.Pool directo

**Decision**: Usar `pg.Pool` de `auth-server.ts` con queries SQL directas, igual que las
demás rutas de `apps/web`. No se usa Prisma en `apps/web`.

**Rationale**: El patrón ya establecido en el proyecto es `pool.connect()` + SQL plano.
La query principal es un JOIN entre `eventos_biometricos`, `eventos_biometricos_desglosados`
y `colaboradores` — es una consulta de lectura sin efectos secundarios.

**Alternatives considered**:
- Prisma ORM — no configurado en `apps/web`; `@prisma/client` solo está en devDependencies.
- `apps/api` (NestJS) — requeriría un endpoint adicional en el backend y cross-service call desde el frontend. Overhead innecesario para una feature de sólo lectura.

---

## D2 — Filtrado server-side vs client-side

**Decision**: Filtrado y paginación server-side con SQL (`WHERE`, `LIMIT`, `OFFSET`). El
cliente envía los parámetros de filtro como query params a `GET /api/eventos-biometricos`.

**Rationale**: La tabla puede contener decenas de miles de registros. Client-side filtering
requeriría traer todos los datos al navegador — inviable a escala. SC-003 especifica
hasta 10.000 eventos en el rango. La query SQL con índices en `checktime` es la solución
correcta.

**Alternatives considered**:
- Client-side filtering con todos los datos en memoria — no escala.
- Cursor-based pagination — overkill para este caso; `OFFSET` es suficiente para paginación
  de hasta 10.000 registros.

---

## D3 — Componente de tabla: MUI Table vs @mui/x-data-grid

**Decision**: Usar componentes MUI estándar (`Table`, `TableHead`, `TableBody`, `TableRow`,
`TableCell`, `TablePagination`) ya instalados en el proyecto. No instalar `@mui/x-data-grid`.

**Rationale**: MUI v9 ya instalado incluye `Table` y `TablePagination` suficientes para
los requisitos. `@mui/x-data-grid` añadiría ~300KB y una dependencia de licencia adicional
(MIT para la versión community). La paginación ya es server-side — no se necesita el modo
`serverSide` de DataGrid.

**Alternatives considered**:
- `@mui/x-data-grid` — potente pero innecesario; agrega dependencia y tamaño de bundle.
- Tabla HTML nativa — no coherente con el sistema de diseño MUI del proyecto.

---

## D4 — Selector de fechas: input HTML nativo

**Decision**: Usar `<input type="date">` HTML nativo envuelto en MUI `TextField`
(prop `type="date"`) para el filtro de rango de fechas. No instalar `@mui/x-date-pickers`.

**Rationale**: `@mui/x-date-pickers` no está instalado y requiere también `dayjs` o
`date-fns` como peer dependency. Los inputs de fecha HTML nativos son suficientes para
seleccionar rangos de fecha simples (desde/hasta). El navegador proporciona el calendario.

**Alternatives considered**:
- `@mui/x-date-pickers` con `dayjs` — más UX pero +2 dependencias nuevas.
- Campos de texto libre — propenso a errores de formato.

---

## D5 — Autorización en el API endpoint

**Decision**: Crear un helper `checkRoles(req, roles[])` inline en el route handler, o
verificar directamente `payload.roles.some(r => ALLOWED.includes(r))` sin crear una
función separada en `auth-server.ts`.

**Rationale**: `checkAdminRole` solo permite ADMINISTRADOR. Esta feature necesita
ADMINISTRADOR + SUPERVISOR. Para no modificar `auth-server.ts` (Open/Closed Principle),
la lógica de autorización multi-rol se maneja directamente en el route handler con la
misma estructura que `checkAdminRole` pero con array de roles permitidos.

**Alternatives considered**:
- Añadir parámetro `roles` a `checkAdminRole` y renombrarlo — cambio breaking en la firma.
- Duplicar la función con nombre diferente — duplicación de código.
- Manejo inline en el route (elegido) — mínima modificación, claro en contexto.

---

## D6 — Actualización de nav-config.ts

**Decision**: Agregar la sección `/eventos` a `NAV_ITEMS` y `ROUTE_ROLES` en
`apps/web/src/lib/nav-config.ts` con roles `['ADMINISTRADOR', 'SUPERVISOR']`.

**Rationale**: El sidebar de feature 012 lee de `NAV_ITEMS` para mostrar las secciones
disponibles por rol. El proxy (`proxy.ts`) lee de `ROUTE_ROLES` para proteger la ruta.
Ambos módulos son la fuente única de verdad de navegación.

**Alternatives considered**:
- No agregar al sidebar — la vista existiría pero sería inaccesible por UI.

---

## D7 — Estructura de URL del endpoint

**Decision**: `GET /api/eventos-biometricos` con query params:
`fecha_desde`, `fecha_hasta`, `colaborador`, `tipo_evento`, `dispositivo`, `estado`,
`page` (default: 1), `page_size` (default: 25, máx: 100).

**Response**:
```json
{
  "eventos": [...],
  "total": 342,
  "page": 1,
  "page_size": 25,
  "total_pages": 14
}
```

**Rationale**: RESTful, compatible con Next.js API Routes, fácil de testear con `curl`.
Los parámetros son opcionales — sin filtros devuelve todos los eventos del día actual.

---

## D8 — Valor por defecto del filtro de fecha

**Decision**: Al cargar la vista, el filtro de fecha se inicializa con `fecha_desde` =
inicio del día actual (00:00:00 GMT-4) y `fecha_hasta` = fin del día actual (23:59:59 GMT-4).

**Rationale**: FR-002 especifica "el día actual como valor por defecto". Los timestamps
en `eventos_biometricos_desglosados.checktime` están almacenados en GMT-4 (Venezuela),
por lo que el filtro de "hoy" debe considerar el timezone del negocio.

**Alternatives considered**:
- UTC — causaría que el "hoy" no coincida con el día laboral en Venezuela.
- Sin valor por defecto — el usuario debería seleccionar fechas siempre; peor UX.
