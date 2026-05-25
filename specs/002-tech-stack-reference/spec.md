# Feature Specification: Referencia del Stack Tecnológico

**Feature Branch**: `002-tech-stack-reference`

**Created**: 2026-05-22

**Status**: Draft

**Type**: Architectural Decision Record — Technical Reference

> ⚠️ **Nota**: Este documento es una referencia técnica, no una feature de usuario final.
> Su propósito es versionar y comunicar las decisiones de stack para que toda planificación
> e implementación futura sea consistente. La sección de requisitos contiene detalles técnicos
> de forma intencional. El checklist de calidad refleja esta excepción.

---

## User Scenarios & Testing

### User Story 1 - Consulta del Stack por Desarrollador Nuevo (Priority: P1)

Un desarrollador que se incorpora al proyecto puede encontrar en un único documento versionado
todas las tecnologías aprobadas, sus versiones exactas y su rol, sin necesidad de explorar el
código o preguntar al equipo.

**Why this priority**: Sin esta referencia, las decisiones de implementación quedan implícitas
en el código y cada nueva feature arriesga introducir dependencias incompatibles o duplicadas.

**Independent Test**: Dado el documento publicado, un desarrollador externo puede identificar
correctamente el framework de frontend, el ORM, la base de datos y las versiones de cada uno
sin acceso al repositorio.

**Acceptance Scenarios**:

1. **Given** un desarrollador accede al documento de referencia del stack,
   **When** necesita saber qué framework de UI usar en el frontend,
   **Then** encuentra la respuesta inequívoca con la versión exacta y el rol.

2. **Given** un desarrollador planifica una feature que requiere acceso a base de datos,
   **When** consulta este documento,
   **Then** conoce el ORM aprobado, el proveedor PaaS y el paquete interno a usar.

---

### User Story 2 - Validación de Decisiones de Planificación (Priority: P2)

Al ejecutar `/speckit-plan` para cualquier feature, el agente de planificación puede usar este
documento como fuente de verdad para las decisiones de stack, sin inventar dependencias ni
contradecir las ya aprobadas.

**Why this priority**: Sin esta referencia explícita, cada plan puede usar versiones distintas
o librerías equivalentes pero incompatibles entre features.

**Independent Test**: Un plan generado para cualquier feature posterior referencia el stack
documentado aquí sin contradicciones.

**Acceptance Scenarios**:

1. **Given** este documento está disponible como referencia,
   **When** se genera el plan de una feature de autenticación,
   **Then** el plan usa Passport + JWT y NestJS, no una alternativa ad-hoc.

---

### Edge Cases

- ¿Qué ocurre si una feature requiere una librería no listada aquí?
  → Debe proponerse como adición al stack con justificación, no incorporarse silenciosamente.
- ¿Qué pasa si se necesita actualizar una versión por vulnerabilidad de seguridad?
  → Actualizar este documento y propagar el cambio versionado.

## Requirements

### Stack Aprobado

#### Monorepo

| Herramienta | Versión | Rol |
|---|---|---|
| npm workspaces | 11.x | Gestor de paquetes del monorepo |
| Turborepo | 2.1 | Orquestador de builds y caché |
| TypeScript | 5.4 | Lenguaje base en todo el repo |
| Node.js | ≥ 20 LTS | Runtime |

#### Frontend — `apps/web`

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js | 14 (App Router) | Framework frontend + rutas API proxy |
| React | 18 | UI library |
| MUI v5 | 5.15 | Component library (Material Design) |
| Emotion | 11 | CSS-in-JS (requerido por MUI) |
| MUI DataGrid | 7.3 | Tablas avanzadas |
| MUI DatePickers | 7.3 | Componentes de fecha |
| Zustand | 4.5 | Estado global del cliente |
| React Hook Form + Zod | 7.x / 3.x | Formularios y validación |
| Axios | 1.6 | Cliente HTTP hacia la API |
| date-fns | 3.6 | Utilitarios de fecha |
| ExcelJS | 4.4 | Exportación a .xlsx |
| csv-parse | 5.5 | Importación de CSVs |
| jose | 5.9 | Verificación JWT en middleware Next.js |
| @vercel/analytics | 2.0 | Analytics de Vercel |

#### Backend — `apps/api`

| Tecnología | Versión | Rol |
|---|---|---|
| NestJS | 10 | Framework REST API |
| Passport + passport-jwt | 0.7 / 4.0 | Estrategia de autenticación JWT |
| @nestjs/jwt | 10.2 | Generación/validación de JWT |
| @nestjs/throttler | 5.1 | Rate limiting (5 req/15 min en login) |
| @nestjs/swagger | 7.3 | Documentación OpenAPI automática |
| bcrypt | 5.1 | Hash de contraseñas |
| class-validator / class-transformer | 0.14 / 0.5 | Validación de DTOs |
| nestjs-zod | 3.0 | Integración Zod ↔ NestJS pipes |
| Resend | 3.2 | Emails transaccionales |
| Sentry | 8.0 | Observabilidad / error tracking |
| cookie-parser | 1.4 | Manejo de cookies HttpOnly |
| Vitest | 1.4 | Tests unitarios |

#### Base de datos / ORM — `packages/database`

| Tecnología | Versión | Rol |
|---|---|---|
| PostgreSQL | — | Base de datos relacional |
| Supabase | — | Proveedor PaaS PostgreSQL |
| Prisma ORM | 5.11–5.22 | Schema, migraciones, cliente |
| pgcrypto | extension | Extensión UUID/crypto en Postgres |

### Functional Requirements

- **FR-001**: Todo código del proyecto DEBE estar escrito en TypeScript 5.4; no se admite
  JavaScript puro en ningún paquete del monorepo.
- **FR-002**: Las dependencias de base de datos DEBEN centralizarse en `packages/database`
  (Prisma schema + cliente generado); ningún otro paquete DEBE definir su propio cliente de BD.
- **FR-003**: El hash de contraseñas DEBE realizarse exclusivamente en el backend (`apps/api`)
  usando `bcrypt`; no se DEBE ejecutar hashing de contraseñas en el frontend.
- **FR-004**: El envío de emails transaccionales DEBE canalizarse a través de `apps/api` usando
  Resend; el frontend no DEBE enviar emails directamente.
- **FR-005**: Las rutas de API del frontend (`apps/web`) actúan exclusivamente como proxy hacia
  `apps/api`; no DEBE haber lógica de negocio en las rutas de Next.js.
- **FR-006**: La autenticación DEBE implementarse con JWT en cookies HttpOnly; no se DEBE
  almacenar tokens en localStorage.
- **FR-007**: Toda adición de una nueva dependencia al monorepo DEBE acompañarse de
  actualización de este documento.

### Key Entities

- **`apps/web`**: Aplicación Next.js 14 con App Router. Contiene UI, formularios y lógica de
  presentación. Se comunica con `apps/api` exclusivamente vía Axios.
- **`apps/api`**: API REST con NestJS 10. Contiene toda la lógica de negocio, autenticación,
  validaciones y acceso a base de datos vía `packages/database`.
- **`packages/database`**: Paquete compartido del monorepo. Contiene el schema Prisma,
  las migraciones y el cliente generado. Es la única fuente de acceso a PostgreSQL/Supabase.

## Success Criteria

### Measurable Outcomes

- **SC-001**: El 100% de las features planificadas referencian las versiones documentadas en
  este spec, sin excepciones no documentadas.
- **SC-002**: Ningún pull request introduce una dependencia de npm que contradiga las reglas
  de capas definidas en FR-003, FR-004 y FR-005.
- **SC-003**: El tiempo de onboarding de un desarrollador nuevo al stack se reduce a menos
  de 30 minutos con este documento como guía.

## Assumptions

- El package name interno del paquete de base de datos es `@workforce/database`
  (resuelve el TODO pendiente en la Constitución que referenciaba `@escolastica/database`).
- Supabase actúa como proveedor PaaS de PostgreSQL; Prisma se conecta a la URL de conexión
  de Supabase directamente. No se usa el cliente JavaScript de Supabase.
- El despliegue de `apps/web` se realiza en Vercel (justifica `@vercel/analytics`).
- El despliegue de `apps/api` se realiza en un servidor compatible con Node.js ≥ 20 LTS.
- `nodemailer` listado inicialmente en `apps/web` se reclasifica a `apps/api`; el frontend
  no DEBE manejar envío de correos directamente (ver FR-004).
- `bcryptjs` listado inicialmente en `apps/web` se reclasifica a `apps/api`; el hashing de
  contraseñas es responsabilidad exclusiva del backend (ver FR-003).

## ⚠️ Acción Requerida — Actualización de la Constitución

La Constitución del proyecto (`.specify/memory/constitution.md`) indica en su sección de Stack:

> UI: **shadcn/ui + Tailwind CSS**

Este documento establece **MUI v5 + Emotion** como la librería de componentes aprobada.
La Constitución DEBE actualizarse para reflejar este cambio antes de iniciar cualquier
implementación de frontend.

Comando sugerido: `/speckit-constitution` con la corrección del campo UI en el stack.
