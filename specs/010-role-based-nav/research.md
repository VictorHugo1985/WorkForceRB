# Research: Navegación por Rol — Next.js 14 App Router

**Feature**: 010-role-based-nav  
**Date**: 2026-05-22

---

## Decision 1 — Route Protection: Middleware + Layout Guards (combinación)

**Decision**: Usar `middleware.ts` para la verificación de autenticación (cookie presente) y `layout.tsx` de Route Group para la verificación de autorización (rol requerido).

**Rationale**: El middleware corre en Edge antes del renderizado React, descartando solicitudes sin cookie de sesión antes de cualquier carga. Los layout guards tienen acceso al contexto completo de sesión y pueden evaluar roles con la lógica multi-rol de spec 010. La combinación evita renderizado innecesario para usuarios no autenticados y centraliza la lógica de rol en un único layout por grupo de rutas.

**Alternatives considered**:
- Solo middleware: funciona para autenticación simple pero no tiene suficiente contexto para lógica multi-rol compleja.
- Solo layout guards: permite que requests no autenticados lleguen al renderizado completo, desperdiciando recursos.

---

## Decision 2 — URL Preservation: Query Parameter `?redirect=`

**Decision**: El middleware añade el parámetro `?redirect=/path/original` al redirigir a login. Tras el login exitoso, el frontend lee este param y navega al destino. Si el destino no es accesible para el rol del usuario, redirige a Inicio.

**Rationale**: Los query params sobreviven redirecciones de middleware y funcionan en boundaries servidor/cliente sin depender de almacenamiento del navegador. Son más confiables que sessionStorage, que puede no estar disponible o ser inconsistente entre pestañas y componentes servidor.

**Alternatives considered**:
- sessionStorage: no accesible desde server components; se pierde si el browser se cierra (alineado con el assumption de la spec, pero inferior para transiciones servidor→cliente).
- Cookie de redireccionamiento: añade complejidad innecesaria en el servidor.

---

## Decision 3 — Route Group Structure en Next.js App Router

**Decision**: Dos grupos raíz:
- `(auth)/` — rutas públicas (login, etc.), sin layout de app shell.
- `(app)/` — todas las rutas autenticadas, con layout de app shell (AppBar + Sidebar). Dentro de `(app)`, sub-grupos sin layout propio para organización: `(admin)/`, `(supervisor)/`, `(shared)/`. La verificación de rol ocurre en el layout raíz de `(app)`.

**Rationale**: Los route groups en App Router no afectan las URLs pero permiten layouts compartidos. Un único layout en `(app)/layout.tsx` gestiona la app shell y los role guards, evitando duplicación. Los sub-grupos son solo organizativos.

**Alternatives considered**:
- Grupos separados por rol con layouts independientes: crea duplicación del app shell en cada grupo. Innecesario dado que el shell es el mismo para todos los roles.
- Estructura plana con middleware exclusivo: requiere lógica de rol duplicada en el middleware, que no tiene acceso a contexto de React.

---

## Decision 4 — Lectura de JWT en App Router (Server + Client)

**Decision**:
- **Server Components**: leen la cookie HttpOnly directamente con `cookies()` de `next/headers` y verifican/decodifican el JWT en el servidor.
- **Client Components**: consumen el estado de Zustand inicializado por el servidor, o llaman al endpoint `GET /api/auth/me` (proxy hacia NestJS) que retorna los claims del usuario como JSON.

**Rationale**: Las cookies HttpOnly son inaccesibles desde JavaScript del cliente por diseño (protección XSS). Los server components pueden leerlas directamente. Para client components, el patrón de hidratación de Zustand desde el servidor evita peticiones adicionales en el caso común.

**Alternatives considered**:
- Cookie no-HttpOnly con claims: sacrifica la protección XSS.
- Fetch `GET /auth/me` en cada render de cliente: genera una petición extra en cada carga de página; el patrón de hidratación es más eficiente.

---

## Decision 5 — Zustand Session State en App Router

**Decision**: El layout raíz `(app)/layout.tsx` (Server Component) lee la sesión, la pasa a un `<SessionProvider>` Client Component que hidrata el Zustand store via `useEffect` en el montaje. El store usa `sessionStorage` como persistence layer (auto-limpia al cerrar el browser, coherente con la política de sesión no persistente de spec 005).

**Rationale**: Mantiene la obtención de datos de auth del lado servidor (donde las cookies son accesibles). Inicializa el estado del cliente deterministamente sin hydration mismatch. El uso de sessionStorage como backend de Zustand alinea la vida útil del estado con la cookie de sesión.

**Alternatives considered**:
- Context API: más simple pero sin persistencia entre navegaciones de SSR.
- Fetch en cliente al montar: introduce un flash de UI (skeleton → contenido) en cada carga.

---

## Decision 6 — Configuración Centralizada de Navegación

**Decision**: Un objeto de configuración `NAV_CONFIG` en `apps/web/src/lib/navigation/config.ts` define las secciones, sus rutas y los roles requeridos. El componente `Sidebar` filtra este config basado en los roles del usuario. Los route guards leen el mismo config para evaluar acceso.

**Rationale**: Una única fuente de verdad para la relación sección→roles evita desincronización entre la navegación visible y la protección de rutas. Cambiar permisos requiere modificar un solo archivo.

**Alternatives considered**:
- Lógica de permisos distribuida en cada componente y layout: duplicación, riesgo de inconsistencia.
- Configuración en base de datos: excesivo para un sistema con roles fijos; añade latencia y complejidad de caché.
