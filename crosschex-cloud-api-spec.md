# CrossChex Cloud — Especificación Técnica de Webhooks y API

> Documentación consolidada para implementación de integración con el sistema de asistencia biométrica Anviz CrossChex Cloud.
> Fuente oficial: https://community.anviz.com (Anviz Developer Community)

---

## 1. Resumen General

CrossChex Cloud ofrece dos mecanismos de integración:

| Mecanismo | Descripción | Uso ideal |
|-----------|-------------|-----------|
| **Webhooks** | CrossChex *empuja* datos a tu servidor en tiempo real al registrarse un evento | Notificaciones en tiempo real de entradas/salidas |
| **REST API** | Tu servidor *consulta* CrossChex para obtener registros | Sincronización periódica, reportes históricos |

> ⚠️ **Requisito previo**: El **Developer Mode** debe estar activado por Anviz en tu cuenta. Para activarlo, escribe a la comunidad en https://community.anviz.com indicando tu Company ID.

---

## 2. Webhooks

### 2.1 ¿Cómo funciona?

```
[Dispositivo biométrico]
        |
        | Time Attendance Record
        v
[CrossChex Cloud]
        |
        | POST (Webhook Event)
        v
[Tu servidor / Customer App]
        |
        | HTTP 200 { "code": 200, "msg": "success" }
        v
[CrossChex Cloud — confirma entrega]
```

> Si tu servidor no responde con éxito, CrossChex reintenta el envío **2 veces en 1 minuto**.

### 2.2 Configuración en CrossChex Cloud

Ir a: **Settings → System → Application → Webhooks**

| Campo | Descripción |
|-------|-------------|
| **URL del servidor** | URL pública de tu endpoint que recibirá los POST |
| **Secreto** | Clave secreta para validar autenticidad del webhook |

Activar el toggle de **Webhooks** y guardar.

---

### 2.3 Headers del Webhook (Request entrante a tu servidor)

CrossChex enviará un `POST application/json` con los siguientes headers:

```json
{
  "nameSpace": "attendance.record",
  "nameAction": "realrecord",
  "version": "1.0",
  "requestId": "d9f3cb8b-4115-ac81-b8d1-09de14c2064d",
  "content-type": "application/json",
  "authorize-type": "authorize-key",
  "authorize-sign": "1"
}
```

| Header | Valor | Descripción |
|--------|-------|-------------|
| `nameSpace` | `attendance.record` | Siempre este valor para registros de asistencia |
| `nameAction` | `realrecord` | Indica que es un registro en tiempo real |
| `version` | `1.0` | Versión del protocolo |
| `requestId` | UUID único | Identificador único de la petición |
| `authorize-type` | `authorize-key` | Tipo de autorización |
| `authorize-sign` | string | Firma de seguridad |

---

### 2.4 Respuesta requerida de tu servidor

Tu endpoint **debe responder** con HTTP 200 y el siguiente JSON:

```json
{
  "code": "200",
  "msg": "success"
}
```

Si no responde correctamente, CrossChex reintentará 2 veces en 1 minuto.

---

### 2.5 Data Dictionary — Check Type Information

El payload del webhook incluirá un campo `checktype` con los siguientes valores:

| Código | Tipo de verificación |
|--------|----------------------|
| 1 | ID + Password |
| 6 | Default |
| 8 | Card + Password |
| 56 | Card |
| 64 | Fingerprint + Password o Facial + Password |
| 128 | (valor de ejemplo en API) |
| 144 | Fingerprint + Card o Facial + Password |
| 192 | Fingerprint o Facial |
| 193 | Fingerprint + Card + Password |

---

## 3. REST API — Obtener Registros

### 3.1 URL Base

```
https://api.ap.crosschexcloud.com/
```

> Para servidor US: `https://api.ap.crosschexcloud.com/`
> Para servidor EU: revisar documentación oficial de Anviz.

---

### 3.2 Paso 1 — Obtener Token de Autenticación

**POST** `https://api.ap.crosschexcloud.com/`

#### Request

| Campo | Valor | Tipo | Requerido | Descripción |
|-------|-------|------|-----------|-------------|
| `header[nameSpace]` | `authorize.token` | Text | Sí | Valor fijo |
| `header[nameAction]` | `token` | Text | Sí | Valor fijo |
| `header[version]` | `1.0` | Text | Sí | Valor fijo |
| `header[requestId]` | UUID único | Text | Sí | Ej: `f1becc28-ad01-b5b2-7cef-392eb1526f39` |
| `header[timestamp]` | ISO 8601 | Text | Sí | Ej: `2022-10-21T07:39:07+00:00` |
| `payload[api_key]` | Tu API Key | Text | Sí | Obtenido desde CrossChex Cloud → Settings → Developer |
| `payload[api_secret]` | Tu API Secret | Text | Sí | Obtenido desde CrossChex Cloud → Settings → Developer |

#### Ejemplo de Request (JSON):

```json
{
  "header": {
    "nameSpace": "authorize.token",
    "nameAction": "token",
    "version": "1.0",
    "requestId": "f1becc28-ad01-b5b2-7cef-392eb1526f39",
    "timestamp": "2024-01-01T07:39:07+00:00"
  },
  "payload": {
    "api_key": "TU_API_KEY",
    "api_secret": "TU_API_SECRET"
  }
}
```

#### Response exitosa (200):

```json
{
  "code": 200,
  "data": {
    "payload": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires": "2022-10-24T07:39:07+00:00"
    },
    "header": {
      "nameSpace": "authorize.token",
      "nameAction": "token",
      "version": "1.0",
      "requestId": "...",
      "timestamp": "..."
    }
  },
  "description": {},
  "error": {}
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `data.payload.token` | String (JWT) | Token para usar en requests posteriores |
| `data.payload.expires` | ISO 8601 | Fecha/hora de expiración del token |

---

### 3.3 Paso 2 — Consultar Registros de Asistencia

**POST** `https://api.ap.crosschexcloud.com/`

#### Request

| Campo | Valor | Tipo | Requerido | Descripción |
|-------|-------|------|-----------|-------------|
| `header[nameSpace]` | `attendance.record` | Text | Sí | Valor fijo |
| `header[nameAction]` | `getrecord` | Text | Sí | Valor fijo |
| `header[version]` | `1.0` | Text | Sí | Valor fijo |
| `header[requestId]` | UUID único | Text | Sí | Debe ser diferente al del token |
| `header[timestamp]` | ISO 8601 | Text | Sí | Timestamp actual |
| `authorize[type]` | `token` | Text | Sí | Valor fijo |
| `authorize[token]` | JWT obtenido | Text | Sí | Token del paso anterior |
| `payload[begin_time]` | ISO 8601 | Text | Sí | Inicio del rango de búsqueda |
| `payload[end_time]` | ISO 8601 | Text | Sí | Fin del rango de búsqueda |
| `payload[workno]` | ID empleado | Text | No | Filtrar por empleado específico |
| `payload[order]` | `asc` / `desc` | Text | No | Orden cronológico (default: `asc`) |
| `payload[page]` | número | Text | Sí | Página (desde 1) |
| `payload[per_page]` | número | Text | Sí | Registros por página (máx. 1000) |

#### Ejemplo de Request (JSON):

```json
{
  "header": {
    "nameSpace": "attendance.record",
    "nameAction": "getrecord",
    "version": "1.0",
    "requestId": "f1becc28-ad01-b5b3-7cef-392eb1526f39",
    "timestamp": "2024-01-01T07:39:07+00:00"
  },
  "authorize": {
    "type": "token",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "payload": {
    "begin_time": "2024-01-01T00:00:00+00:00",
    "end_time": "2024-01-31T23:59:59+00:00",
    "order": "asc",
    "page": 1,
    "per_page": 100
  }
}
```

#### Response exitosa (200):

```json
{
  "code": 200,
  "data": {
    "payload": {
      "count": 148,
      "list": [
        {
          "checktype": 128,
          "checktime": "2022-07-20T20:15:05+00:00",
          "device": {
            "serial_number": "1750120622290025",
            "name": "FaceDeep3-IRT10"
          },
          "employee": {
            "first_name": "Juan",
            "last_name": "Perez",
            "workno": "1001"
          }
        }
      ],
      "page": 1,
      "perPage": 100,
      "pageCount": 2
    },
    "header": {
      "nameSpace": "attendance.record",
      "nameAction": "getrecord",
      "version": "1.0",
      "requestId": "...",
      "timestamp": "..."
    }
  },
  "description": {},
  "error": {}
}
```

#### Campos del registro (`list[]`):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `checktype` | Number | Tipo de verificación (ver tabla Data Dictionary) |
| `checktime` | String ISO 8601 | Fecha y hora del marcaje |
| `device.serial_number` | String | Número de serie del dispositivo biométrico |
| `device.name` | String | Nombre del dispositivo |
| `employee.first_name` | String | Nombre del empleado |
| `employee.last_name` | String | Apellido del empleado |
| `employee.workno` | String | ID / código del empleado en el sistema |

---

## 4. Notas de Implementación

### Activar Developer Mode
Para acceder a los webhooks y la API, Anviz debe habilitar manualmente el **Developer Mode** en tu cuenta. El proceso es:
1. Ir a https://community.anviz.com
2. Publicar en el hilo de integración indicando tu **Company ID**
3. Anviz activa el modo en 1-2 días hábiles

### Seguridad del Webhook
- Validar el header `authorize-sign` con tu **Secreto** configurado para verificar que el request viene de CrossChex.
- Siempre responder HTTP 200 con `{"code":"200","msg":"success"}` para evitar reenvíos.

### Paginación (API)
- El máximo es **1000 registros por página**.
- Iterar incrementando `page` hasta que `page >= pageCount`.

### Token JWT
- El token expira según el campo `expires`.
- Implementar lógica de renovación automática antes de expirar.

### Collection Postman oficial
Disponible en: https://drive.google.com/file/d/1ph76dC8t_Uh1aRlJJ3An6YBNP41HbIZW/view

---

## 5. Flujo de Implementación Sugerido

```
1. Activar Developer Mode en tu cuenta CrossChex
2. Obtener api_key y api_secret desde Settings → Developer
3. Implementar endpoint receptor de webhooks (Node.js / Python / etc.)
4. Configurar URL del webhook en CrossChex Cloud
5. Testear con marcaje real en el dispositivo biométrico
6. (Opcional) Implementar polling con REST API para datos históricos
```

---

*Documentación consolidada por Claude — Mayo 2026*
*Fuentes: Anviz Community, CrossChex Cloud UI*
