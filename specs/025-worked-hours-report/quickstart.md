# Quickstart: Reporte de Horas Trabajadas

No requiere migración.

```bash
cd apps/web && npm run dev
```

## Validación manual (rediseño con gráficos)

1. Entrar como ADMINISTRADOR → "Horas trabajadas": abre **siempre** en "Último trimestre" con "Promedio de todos los colaboradores"; se ven dos gráficos (semanas y meses) y 4 indicadores.
2. Elegir un colaborador en el selector (buscar por nombre o cédula) → las columnas pasan a sus horas y aparece la línea "Promedio de todos" con leyenda.
3. Pasar el mouse sobre una columna → tooltip con el rango, las horas, el promedio y los días incompletos.
4. Clic en una columna (con colaborador) → detalle diario cuya suma = valor de la columna.
5. "Último año" → los meses o semanas previos a jun 2026 aparecen como una franja "sin datos"; la columna del período en curso se ve más clara (parcial).
6. "Ver tabla" en cada gráfico → mismos valores en forma de tabla.
7. Recargar la página tras elegir "Último año" → vuelve a abrir en trimestre.

**Coherencia del cálculo (SC-005)**
- Elegir un día de un colaborador y comparar con el cálculo manual de sus marcaciones en "Eventos Biométricos" (pares consecutivos).

**Acceso**
- SUPERVISOR: ve el reporte completo. CAJERO/COLABORADOR: no ve la opción y `/horas-trabajadas` redirige a `/dashboard`.

**Sin datos de liquidaciones**
- `grep -n "liquidacion_" apps/web/src/lib/horas-trabajadas.ts apps/web/src/app/api/horas-trabajadas -r` → sin resultados.
