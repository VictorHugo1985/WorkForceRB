# Quickstart: Gestión Completa de Colaboradores

**Feature**: 014-employee-management | **Date**: 2026-05-26

Pre-requisito: sesión activa como ADMINISTRADOR en la aplicación.

---

## Escenario 1 — Ver lista de colaboradores (US1)

1. Hacer clic en "Colaboradores" en el sidebar.
2. **Verificar**: Se muestra una tabla con columnas Nombre, Cédula, Área, Estado.
3. **Verificar**: Por defecto solo se muestran colaboradores activos (sin el chip "Inactivo").

## Escenario 2 — Búsqueda en tiempo real (US1)

1. Desde la lista, escribir parte de un nombre en el campo de búsqueda.
2. **Verificar**: La tabla se filtra instantáneamente sin recargar la página.
3. Borrar el texto de búsqueda.
4. **Verificar**: La lista vuelve a mostrar todos los colaboradores activos.

## Escenario 3 — Búsqueda sin resultados (US1 edge case)

1. Escribir un texto que no coincida con ningún colaborador.
2. **Verificar**: Se muestra "No se encontraron colaboradores con ese criterio" y la tabla está vacía.

## Escenario 4 — Mostrar inactivos (US1)

1. Desde la lista, activar el control "Mostrar inactivos".
2. **Verificar**: Los colaboradores inactivos aparecen en la lista con un chip "Inactivo" visible.

## Escenario 5 — Navegar al perfil (US1)

1. Hacer clic en una fila de la lista.
2. **Verificar**: Se navega a `/colaboradores/{id}` con el perfil completo del colaborador
   (nombre, cédula, área, supervisor, tarifa, horario, códigos biométricos).

## Escenario 6 — Crear nuevo colaborador (US2)

1. Desde la lista, hacer clic en "Nuevo colaborador".
2. **Verificar**: Se navega al wizard en `/colaboradores/nuevo`.
3. Completar los 6 pasos del wizard.
4. Confirmar en el paso final.
5. **Verificar**: Se redirige al perfil del colaborador recién creado.
6. Volver a la lista.
7. **Verificar**: El nuevo colaborador aparece en la lista.

## Escenario 7 — Edición inline (US3)

1. Desde el perfil de un colaborador activo, hacer clic en "Editar".
2. **Verificar**: Los campos nombre, apellido, cédula, área y supervisor se vuelven editables.
3. Cambiar el área de trabajo a un valor diferente.
4. Hacer clic en "Guardar".
5. **Verificar**: El perfil muestra el área actualizada y un mensaje de éxito.
6. **Verificar**: Los campos tarifa, horario y códigos biométricos siguen en modo vista (no editables).

## Escenario 8 — Cancelar edición (US3)

1. Desde el perfil, hacer clic en "Editar".
2. Modificar el nombre.
3. Hacer clic en "Cancelar".
4. **Verificar**: El nombre original se restaura y los campos vuelven a modo vista.

## Escenario 9 — Error de cédula duplicada en edición (US3 edge case)

1. Abrir el perfil del colaborador A y hacer clic en "Editar".
2. Cambiar la cédula a la cédula del colaborador B (que ya existe).
3. Hacer clic en "Guardar".
4. **Verificar**: Se muestra un error "Ya existe un colaborador con la cédula ingresada." Sin guardar.

## Escenario 10 — Dar de baja (US4)

1. Desde el perfil de un colaborador activo, hacer clic en "Dar de baja".
2. **Verificar**: Se abre un Dialog modal con mensaje de confirmación.
3. Hacer clic en "Cancelar".
4. **Verificar**: El colaborador sigue activo, el dialog se cierra.
5. Hacer clic en "Dar de baja" nuevamente, luego confirmar.
6. **Verificar**: El colaborador queda con estado "Inactivo" visible en el perfil.
7. Volver a la lista (sin activar "Mostrar inactivos").
8. **Verificar**: El colaborador ya no aparece en la lista.

## Escenario 11 — Reactivar colaborador (US4)

1. Activar "Mostrar inactivos" en la lista.
2. Hacer clic en un colaborador inactivo.
3. **Verificar**: El perfil muestra un banner indicando que el colaborador está inactivo.
4. Hacer clic en "Reactivar".
5. **Verificar**: El colaborador vuelve al estado "Activo".
6. Volver a la lista sin el filtro de inactivos.
7. **Verificar**: El colaborador aparece nuevamente en la lista.

## Escenario 12 — Editar colaborador inactivo (edge case)

1. Acceder al perfil de un colaborador inactivo.
2. **Verificar**: Se muestra un banner/chip "Inactivo" visible.
3. Hacer clic en "Editar".
4. **Verificar**: El formulario de edición permite modificar los campos (la edición no está bloqueada).
5. Guardar un cambio.
6. **Verificar**: Los cambios se guardan correctamente.
