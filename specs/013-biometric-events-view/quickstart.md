# Quickstart: Probar el Visualizador de Eventos Biométricos

**Feature**: 013-biometric-events-view
**Base URL**: `https://jornalero.vercel.app`

---

## Escenario 1 — Vista carga con eventos del día actual (US1, US2)

1. Iniciar sesión como `victor.hpp@gmail.com` (rol ADMINISTRADOR)
2. Hacer clic en "Eventos Biométricos" en el sidebar
3. Verificar que la vista carga una tabla con eventos del día actual (si hay marcaciones hoy)
4. Verificar que se muestran las columnas: Fecha y Hora, Colaborador, Tipo, Dispositivo, Estado

**Esperado**: Tabla paginada con eventos del día, ordenados por hora descendente.

---

## Escenario 2 — Filtrar por rango de fechas (US1)

1. En la vista de eventos, cambiar `Fecha desde` a hace 7 días y `Fecha hasta` a hoy
2. Hacer clic en "Filtrar" (o esperar auto-actualización)
3. Verificar que la tabla muestra eventos de los últimos 7 días

**Esperado**: Tabla actualizada con eventos del rango seleccionado. El contador de total
de registros refleja la cantidad correcta.

---

## Escenario 3 — Filtrar por nombre de colaborador (US1)

1. Con eventos visibles en la tabla, escribir el nombre de un colaborador conocido en el campo "Colaborador"
2. Verificar que la tabla muestra únicamente los eventos de ese colaborador

**Esperado**: Tabla filtrada a eventos del colaborador buscado. Si no hay resultados,
mensaje de "No se encontraron eventos".

---

## Escenario 4 — Filtrar por tipo de evento (US1)

1. En el desplegable "Tipo de evento", seleccionar "Entrada"
2. Verificar que la tabla muestra únicamente eventos de tipo ENTRADA

**Esperado**: Solo eventos de entrada visibles. El chip de tipo en la tabla es verde.

---

## Escenario 5 — Filtros combinados (US1)

```bash
# Verificar via API con múltiples filtros
curl -s "https://jornalero.vercel.app/api/eventos-biometricos?tipo_evento=ENTRADA&estado=RESUELTO&page_size=5" \
  -H "Cookie: access_token=<token>"
```

**Esperado**: JSON con `eventos` que tienen `tipo_evento: "ENTRADA"` y `estado_resolucion: "RESUELTO"`.

---

## Escenario 6 — Paginación (US2)

1. Seleccionar un rango de fechas amplio (ej. último mes) que devuelva más de 25 eventos
2. Verificar que se muestran controles de paginación: página actual, total de páginas, botones anterior/siguiente
3. Hacer clic en "Siguiente página"
4. Verificar que la página 2 muestra los siguientes 25 eventos

**Esperado**: Navegación correcta entre páginas manteniendo los filtros activos.

---

## Escenario 7 — Cambiar tamaño de página (US2)

1. Con resultados paginados, cambiar el tamaño de página de 25 a 50
2. Verificar que la tabla actualiza mostrando 50 registros por página

**Esperado**: 50 registros en pantalla. El total de páginas se recalcula correctamente.

---

## Escenario 8 — Filtrar por dispositivo (US3)

1. En el desplegable "Dispositivo", seleccionar un dispositivo específico
2. Verificar que la tabla muestra solo eventos del dispositivo seleccionado

**Esperado**: Todos los eventos visibles tienen `device_name` igual al seleccionado.

---

## Escenario 9 — Filtrar por estado (US3)

1. En el desplegable "Estado", seleccionar "Sin resolver"
2. Verificar que la tabla muestra únicamente eventos con `estado_resolucion = SIN_RESOLVER`
3. Verificar que la columna "Colaborador" muestra el workno (no un nombre) en esos eventos

**Esperado**: Eventos no resueltos visibles con workno como identificador.

---

## Escenario 10 — Control de acceso: CAJERO sin acceso

```bash
# Login como CAJERO y verificar que /eventos no está disponible
curl -sv "https://jornalero.vercel.app/eventos" -H "Cookie: access_token=<token_cajero>"
```

**Esperado**: Redirect a `/dashboard` — el rol CAJERO no tiene acceso a esta ruta.

---

## Escenario 11 — Sin resultados (edge case)

1. Escribir en el campo "Colaborador" un nombre que no existe en el sistema
2. Verificar que la tabla muestra el mensaje "No se encontraron eventos con los filtros seleccionados"

**Esperado**: Mensaje informativo, sin tabla vacía ni error.

---

## Escenario 12 — Evento sin resolver (workno en tabla)

1. Filtrar por `Estado: Sin resolver`
2. Verificar que en la columna "Colaborador" aparece el workno del empleado (ej. "0042") en lugar de un nombre

**Esperado**: Eventos no resueltos muestran el código biométrico en la columna de colaborador,
visualmente diferenciado (ej. en gris o con prefijo "Código:").
