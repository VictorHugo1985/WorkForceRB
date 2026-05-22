<!--
SYNC IMPACT REPORT
Version change: 1.0.1 → 1.1.0
Modified principles:
  - VIII. Control de Acceso Basado en Roles (RBAC):
      • "Dos roles fijos" → "Cuatro roles"
      • Añadidos: CAJERO (procesamiento de pagos) y COLABORADOR (acceso básico)
      • Añadida regla: permisos multi-rol aditivos; nivel más permisivo prevalece
      • Ampliado detalle de responsabilidades por rol
Added sections: N/A
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ sin cambios necesarios (Constitution Check es genérico)
  - .specify/templates/spec-template.md — ✅ sin cambios necesarios
  - .specify/templates/tasks-template.md — ✅ sin cambios necesarios
  - .specify/templates/commands/ — ✅ directorio no existe
Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Confirmar fecha oficial de ratificación si difiere de 2026-05-20.
  - specs/009-create-system-user y specs/010-role-based-nav documentan los detalles de CAJERO y
    COLABORADOR. La enmienda al modelo de datos (enum RolUsuario en spec 003) es prerrequisito
    de implementación.
-->

# Workforce — Rosa Betania Constitution

## Principios Fundamentales

### I. Arquitectura Basada en Datos — NO NEGOCIABLE

El diseño de la base de datos relacional constituye el contrato estructural del sistema y la fuente
única de verdad. Ningún desarrollo de backend o frontend PUEDE iniciarse sin que el modelo de datos
esté definido y aprobado. El esquema base delimita el alcance funcional del sistema y previene el
desbordamiento del proyecto. Una vez aprobado, el esquema base NO DEBE modificarse para incorporar
nuevas funcionalidades; el crecimiento se realiza mediante extensiones modulares que no alteren la
estructura ni el código existentes. El modelo de datos DEBE incluir un diccionario de datos con
tipos, restricciones y relaciones.

### II. Código Limpio y Crecimiento Modular

Todo el código DEBE cumplir principios de Clean Code: nombres descriptivos, funciones de
responsabilidad única, bajo acoplamiento y alta cohesión. La arquitectura DEBE permitir crecimiento
progresivo sin modificar código existente (principio abierto/cerrado — OCP). No se permitirá
lógica duplicada ni soluciones temporales que comprometan la mantenibilidad futura. Toda nueva
funcionalidad DEBE integrarse como extensión modular del sistema.

### III. Inmutabilidad del Registro Biométrico

Los eventos biométricos capturados son registros de auditoría de solo escritura (append-only).
Ningún evento biométrico existente DEBE ser modificado ni eliminado directamente. Toda corrección
DEBE realizarse mediante entradas de ajuste explícitas que referencien el evento original. El
historial completo de eventos DEBE ser siempre reconstruible desde la base de datos.

### IV. Cálculo Determinístico y Auditable

Toda liquidación de horas (ordinarias, extras) y bonos (transporte, alimentación) DEBE producir el
mismo resultado dado el mismo conjunto de entradas en cualquier momento. Cada cálculo de pago DEBE
dejar una traza de auditoría que vincule: eventos biométricos de entrada, reglas de negocio
aplicadas (con su versión vigente), y monto resultante. Recalcular el pago de cualquier colaborador
para cualquier semana cerrada DEBE ser posible en cualquier momento futuro.

### V. Reglas de Negocio Configurables — NO NEGOCIABLE

Los horarios, tarifas por hora, umbrales de hora extra, rangos de bonos y descuentos DEBEN ser
configurables por colaborador o grupo; ninguna regla de negocio puede estar hardcodeada en el
código fuente. Cada cambio de configuración DEBE ser versionado con fecha de vigencia, de modo que
el cálculo de semanas pasadas use siempre la configuración que estaba vigente en ese período.

### VI. Ciclo de Pago Semanal como Unidad Primaria

La semana laboral es la unidad fundamental de negocio del sistema. Todas las agregaciones, cierres,
reportes y pagos se orientan al ciclo semanal. La regla por defecto es una sola semana activa; el
resto DEBEN estar cerradas e inmutables. El sistema DEBE soportar múltiples semanas abiertas en
paralelo únicamente si es estrictamente necesario. Se pueden acoplar más de una semana para la
consolidación de un pago.

### VII. Integración con Medios Biométricos

El sistema DEBE soportar dos modalidades de integración con relojes biométricos:

- **Webhook en tiempo real**: Recepción de eventos HTTP desde dispositivos compatibles.
- **Importación CSV**: Carga de archivos de volcado generados por dispositivos sin conectividad
  directa.

Ambas modalidades DEBEN normalizar los eventos al mismo esquema interno. El sistema NO DEBE perder
registros ante picos de eventos biométricos concurrentes (ej. entrada/salida masiva de turno).

### VIII. Control de Acceso Basado en Roles (RBAC)

Cuatro roles definen los límites de acceso del sistema. Un usuario puede tener múltiples roles
simultáneamente; sus permisos son la unión de todos sus roles asignados. El nivel de acceso dentro
de cada sección refleja el rol más permisivo disponible entre los roles del usuario.

- **Administrador**: acceso total — configuración del sistema, gestión de colaboradores,
  gestión de cuentas de usuario, revisión y aprobación de liquidaciones, registro de pagos.
- **Supervisor**: gestión del equipo asignado — revisión de asistencia, ajustes de liquidación,
  aprobación de liquidaciones de su equipo, vista de solo lectura del estado de pagos.
- **Cajero**: procesamiento de pagos — acceso a la cola de consolidados aprobados y registro
  de pagos efectuados. Sin acceso a configuración ni gestión de personal.
- **Colaborador**: acceso básico al sistema — vista de inicio. Funcionalidades específicas
  para este rol se definirán en features futuras.

Ninguna operación de escritura sensible (ajuste, cierre, pago, configuración) DEBE ejecutarse sin
verificación de rol. No hay endpoints de escritura anónimos.

### IX. Trazabilidad Obligatoria de Ajustes y Justificaciones

Todo ajuste manual, justificación de ausencia, descuento o modificación de marcación DEBE registrar:
usuario que lo realizó, timestamp, motivo documentado y referencia al evento o período afectado.
Los ajustes no modifican el registro biométrico original (ver Principio III); se añaden como
entradas auditables independientes.

### X. Disponibilidad de Asistencia en Tiempo Real

La vista de asistencia activa DEBE reflejar los eventos biométricos con una latencia máxima de
60 segundos desde el evento al dashboard. El sistema NO DEBE depender exclusivamente de
procesamiento batch para las vistas en curso. Las vistas históricas cerradas pueden ser batch;
las vistas en curso DEBEN ser reactivas.

### XI. Seguridad y Protección de Datos

Los datos de nómina y biométricos son información sensible: DEBEN transmitirse y almacenarse
cifrados. Toda comunicación entre frontend y backend DEBE autenticarse con tokens de sesión. Las
migraciones de base de datos DEBEN ser reversibles (up/down); ningún deploy puede dejar la base en
estado inconsistente. El sistema DEBE implementar sesiones seguras, expiración por inactividad y
protección contra fuerza bruta.

## Alcance del MVP

El alcance del MVP queda estrictamente delimitado a:

- Gestión de usuarios con roles jerárquicos y perfiles detallados (validación de email obligatoria).
- Autenticación segura mediante correo electrónico.
- Gestión de medios biométricos (registro y configuración de reloj biométrico 1).
- Registro de colaboradores y sus códigos en los distintos relojes biométricos.
- Sistema de auditoría automática para acciones críticas.

Cualquier funcionalidad fuera de este alcance requerirá evaluación formal y justificación basada
en impacto organizacional real, siguiendo el proceso de Governance definido a continuación.

## Restricciones Arquitectónicas

- Base de datos relacional obligatoria.
- Arquitectura por capas con separación clara de responsabilidades.
- Monorepo gestionado con **Turborepo** (`apps/api` + `apps/web`).
- Validaciones obligatorias en backend; nunca únicamente en frontend.
- Diseño responsive obligatorio con enfoque mobile-first.
- El modelo de datos define las relaciones estructurales del sistema.

## Flujo de Desarrollo

1. El modelo entidad-relación del MVP DEBE aprobarse antes de cualquier desarrollo funcional.
2. Ninguna historia de usuario se implementa sin criterios de aceptación claros.
3. Toda nueva funcionalidad DEBE demostrar compatibilidad con el esquema de datos existente.
4. Refactorizaciones mayores requieren justificación técnica documentada.
5. La simplicidad prevalece sobre la sofisticación técnica.
6. Toda PR DEBE incluir verificación de cumplimiento de esta Constitución.

## Stack Tecnológico

### Backend (`apps/api`) — NestJS

| Componente | Tecnología |
|---|---|
| Framework | NestJS (decoradores, módulos, inyección de dependencias) |
| Auth | Passport + JWT (cookies HttpOnly) |
| ORM | Prisma (`@workforce/database`) |
| Validación | `class-validator` + Zod + `nestjs-zod` |
| Documentación | Swagger (`@nestjs/swagger`) |
| Rate limiting | `@nestjs/throttler` |
| Email | Nodemailer + Resend |
| Monitoreo | Sentry |

### Frontend (`apps/web`) — Next.js 14

| Componente | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | **MUI v5 (Material UI 5.15) + Emotion 11** |
| Forms | React Hook Form + Zod |
| Estado global | Zustand |
| HTTP | Axios |

> **Nota sobre UI**: MUI v5 (Material UI) con Emotion como motor CSS-in-JS es la librería de
> componentes aprobada. Provee DataGrid, DatePickers y un sistema de diseño Material completo
> alineado con los requisitos de tablas avanzadas y selección de fechas del sistema.
> Ver stack completo en `specs/002-tech-stack-reference/spec.md`.

## Governance

Esta Constitución prevalece sobre cualquier práctica técnica no documentada en el proyecto.

Toda propuesta que implique modificar el modelo de datos base o ampliar el alcance del MVP DEBE
incluir:

1. Justificación funcional formal (basada en las especificaciones de la carpeta `specs/`).
2. Evaluación de impacto estructural.
3. Plan de migración si aplica.
4. Aprobación explícita del responsable técnico del proyecto.

La complejidad debe justificarse; la simplicidad es el estándar por defecto.

Las enmiendas a esta Constitución siguen versionado semántico:

- **MAJOR**: Eliminación o redefinición retroincompatible de principios o secciones de gobernanza.
- **MINOR**: Adición de nuevo principio, sección o guía material.
- **PATCH**: Clarificaciones, correcciones de redacción o ajustes no semánticos.

**Version**: 1.1.0 | **Ratified**: 2026-05-20 | **Last Amended**: 2026-05-22
