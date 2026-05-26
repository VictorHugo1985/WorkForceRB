# Quickstart: Probar el Sidebar de Navegación por Rol

**Feature**: 012-sidebar-nav
**Base URL**: `https://jornalero.vercel.app`

---

## Escenario 1 — ADMINISTRADOR ve todas las secciones (US1)

1. Iniciar sesión como `victor.hpp@gmail.com` (rol ADMINISTRADOR)
2. Verificar que el sidebar muestra exactamente 6 ítems:
   Inicio, Colaboradores, Configuración, Liquidaciones, Cola de Pagos, Usuarios del Sistema
3. Hacer clic en "Colaboradores" → navegar a `/colaboradores`
4. El sidebar debe resaltar "Colaboradores" como sección activa
5. Navegar a `/colaboradores/nuevo` → el sidebar sigue resaltando "Colaboradores"

**Esperado**: Sidebar visible en desktop con los 6 ítems. Indicador activo correcto en sub-páginas.

---

## Escenario 2 — SUPERVISOR ve secciones filtradas (US1)

1. Crear un usuario con rol SUPERVISOR (o usar cuenta existente)
2. Iniciar sesión con ese usuario
3. Verificar que el sidebar muestra solo 3 ítems: Inicio, Liquidaciones, Cola de Pagos
4. Verificar que NO aparecen: Colaboradores, Configuración, Usuarios del Sistema

**Esperado**: Sidebar con 3 ítems exactos para SUPERVISOR.

---

## Escenario 3 — CAJERO ve secciones filtradas (US1)

1. Iniciar sesión como usuario con rol CAJERO
2. Verificar que el sidebar muestra solo 2 ítems: Inicio, Cola de Pagos

**Esperado**: Sidebar con 2 ítems exactos para CAJERO.

---

## Escenario 4 — COLABORADOR solo ve Inicio (US1)

1. Iniciar sesión como usuario con rol COLABORADOR
2. Verificar que el sidebar muestra solo 1 ítem: Inicio

**Esperado**: Sidebar con solo "Inicio".

---

## Escenario 5 — Protección de ruta (US2 de spec 010)

```bash
# Intentar acceder a /colaboradores como CAJERO (o cualquier rol sin acceso)
# Abrir en el navegador: https://jornalero.vercel.app/colaboradores
```

**Esperado**: Redirección automática a `/dashboard` sin mostrar contenido de Colaboradores.

---

## Escenario 6 — Indicador de sección activa en sub-páginas (US2)

1. Navegar a `/colaboradores/nuevo`
2. Verificar que en el sidebar el ítem "Colaboradores" aparece resaltado como activo

**Esperado**: Indicador activo en "Colaboradores" aunque la URL sea una sub-página.

---

## Escenario 7 — Responsive mobile (US3)

1. Abrir la aplicación en modo mobile (DevTools → 375px de ancho)
2. Verificar que el sidebar está oculto y aparece un botón hamburger
3. Tocar el botón hamburger → el drawer se despliega
4. Seleccionar una sección → el drawer se cierra y el usuario llega a la sección

**Esperado**: Drawer funcional en mobile. Se cierra al seleccionar o tocar fuera.

---

## Escenario 8 — Información del usuario y logout en pie del sidebar (US4)

1. Verificar que el pie del sidebar muestra el nombre del usuario autenticado
2. Hacer clic en "Cerrar sesión"

**Esperado**: Nombre visible al fondo del sidebar. Logout cierra sesión y redirige a `/login`.

---

## Escenario 9 — Expiración de sesión (spec 010 FR-006)

> Este escenario requiere manipular el JWT o esperar 2 horas.
> Alternativa rápida: modificar `JWT_TTL_SECONDS` a 60 en desarrollo y esperar.

**Esperado**: Al expirar el token, el sistema redirige automáticamente a `/login?expired=1`
sin que el usuario realice ninguna acción.

---

## Escenario 10 — Usuario multi-rol (US3 de spec)

1. Crear usuario con roles SUPERVISOR + CAJERO
2. Iniciar sesión
3. Verificar que el sidebar muestra la unión: Inicio, Liquidaciones, Cola de Pagos

**Esperado**: 3 ítems (unión de roles, sin duplicados, en orden canónico).
