# Quickstart: Evaluaciones del Personal

## 1. Aplicar la migración

En el SQL Editor de Supabase, ejecutar `specs/024-staff-evaluations/migration.sql`.
Crea `criterios_evaluacion`, `evaluaciones` y `evaluacion_detalles`, y siembra 4 criterios al 25%.
Para revertir: `migration-down.sql`.

Verificación:
```sql
SELECT nombre, peso FROM criterios_evaluacion WHERE activo;   -- 4 filas
SELECT SUM(peso) FROM criterios_evaluacion WHERE activo;      -- 100.00
```

## 2. Levantar la app

```bash
cd apps/web && npm run dev
```

## 3. Validación manual (por historia de usuario)

**US1 – Criterios (ADMINISTRADOR)**
1. Configuración → pestaña "Criterios de evaluación": se ven los 4 criterios, suma 100% y estado "Configuración válida".
2. Cambiar Puntualidad a 30% (edición individual) → la suma muestra 105% y el estado pasa a no válido.
3. Ir a Evaluaciones → "Nueva evaluación" → aparece un aviso de que los criterios no suman 100% y no se puede guardar.
4. "Redistribuir pesos" → 30/20/20/30 → guardar → suma 100%.
5. Crear "puntualidad" (minúsculas) → error de duplicado.

**US2 – Registrar (ADMINISTRADOR o SUPERVISOR)**
1. Evaluaciones → buscar un colaborador por cédula → "Nueva evaluación".
2. Dejar un criterio vacío → no deja guardar y dice cuál falta.
3. Puntajes 8/7/9/10 con pesos 30/20/20/30 → vista previa 8.60 → guardar → el histórico muestra 8.60.
4. Fecha futura → rechazada.
5. Concurrencia: abrir el formulario, en otra pestaña (como admin) cambiar un peso, volver y guardar → mensaje "Los criterios cambiaron, recargue el formulario".

**US3 – Histórico**
1. Registrar 3 evaluaciones → aparecen ordenadas de la más reciente a la más antigua, con promedio y última fecha.
2. Renombrar un criterio → el detalle de las evaluaciones viejas mantiene el nombre original.
3. Activar "Incluir inactivos" → un colaborador dado de baja aparece sin el botón "Nueva evaluación" y con su histórico visible.

**US4 – Anular (ADMINISTRADOR)**
1. Anular sin motivo → bloqueado. Con motivo → aparece "Anulada" con motivo, usuario y fecha; el promedio se recalcula sin ella.
2. Como SUPERVISOR → el botón "Anular" no aparece; un POST directo a `/anular` devuelve 403.

**Acceso**
- CAJERO/COLABORADOR: "Evaluaciones" no aparece en el sidebar y `/evaluaciones` redirige a `/dashboard`.
- SUPERVISOR: no ve Configuración.

**Auditoría**
```sql
SELECT accion, descripcion, creado_en FROM registros_auditoria
WHERE accion LIKE 'CRITERIO_EVALUACION_%' OR accion LIKE 'EVALUACION_%'
ORDER BY creado_en DESC LIMIT 20;
```
