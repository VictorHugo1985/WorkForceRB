# Quickstart: Reporte de Horas Trabajadas

No requiere migración.

```bash
cd apps/web && npm run dev
```

## Validación manual

**US1 – Por mes**
1. Entrar como ADMINISTRADOR → "Horas trabajadas": por defecto "Último trimestre" + "Por mes" → 3 columnas (sep, oct, nov) + Total; noviembre marcado como parcial.
2. "Último año" → 12 columnas; los meses anteriores a jun 2026 muestran "sin datos" (no 0 h).
3. Un colaborador activo sin marcaciones en un mes → 0.0 h.

**US2 – Por semana**
1. "Por semana" → columnas lunes a domingo con rango de fechas; la primera recortada al día 1 del período, la última parcial.
2. Para 3 colaboradores, el Total coincide entre "Por mes" y "Por semana".

**US3 – Filtros**
1. Filtrar un área → solo sus colaboradores; las filas Total y Promedio se recalculan.
2. Ordenar por Total (desc/asc); buscar por cédula.
3. "Incluir inactivos" → aparecen los dados de baja con horas en el período.

**US4 – Detalle**
1. Abrir una celda → la suma de las horas diarias = valor de la celda.
2. Una celda con "⚠2" → el detalle muestra 2 días "Incompleto" con su marcación suelta.

**Coherencia del cálculo (SC-005)**
- Elegir un día de un colaborador y comparar con el cálculo manual de sus marcaciones en "Eventos Biométricos" (pares consecutivos).

**Acceso**
- SUPERVISOR: ve el reporte completo. CAJERO/COLABORADOR: no ve la opción y `/horas-trabajadas` redirige a `/dashboard`.

**Sin datos de liquidaciones**
- `grep -n "liquidacion_" apps/web/src/lib/horas-trabajadas.ts apps/web/src/app/api/horas-trabajadas -r` → sin resultados.
