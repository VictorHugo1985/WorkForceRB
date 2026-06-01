# API Contracts: Feature 008 — Configuración de Tarifa y Plantillas de Horario

All endpoints require ADMIN role (`checkAdminRole`). All responses are JSON.

---

## Tarifa Horaria

### PATCH /api/colaboradores/[id]/tarifa

Actualiza la tarifa horaria de un colaborador. Cierra el registro activo y crea uno nuevo.

**Request**:
```json
{ "valor": 18.5 }
```

**Validación**: `valor > 0` (número positivo). Rechaza con 400 si `valor ≤ 0` o no es número.

**Response 200**:
```json
{
  "tarifa": {
    "id": "uuid",
    "valor": 18.5,
    "unidad": "Bs.",
    "vigente_desde": "2026-06-01"
  },
  "tarifa_anterior": {
    "id": "uuid",
    "valor": 15.0,
    "vigente_hasta": "2026-05-31"
  }
}
```

**Response 404**: `{ "error": "COLABORADOR_NOT_FOUND" }` si el colaborador no existe.

**Side effects**:
1. `UPDATE configuraciones_reglas SET vigente_hasta = CURRENT_DATE - 1 WHERE colaborador_id = $id AND tipo = 'TARIFA_HORA' AND vigente_hasta IS NULL`
2. `INSERT INTO configuraciones_reglas (tipo, clave, valor, unidad, aplica_a, colaborador_id, vigente_desde, creado_por) VALUES ('TARIFA_HORA', 'Tarifa hora ordinaria', $valor, 'Bs.', 'COLABORADOR', $id, CURRENT_DATE, $userId)`
3. `INSERT INTO registros_auditoria` con accion `TARIFA_HORA_ACTUALIZADA`, datos_anteriores (valor anterior o null), datos_nuevos (valor nuevo)

---

## Plantillas de Horario

### GET /api/plantillas-horario

Lista todas las plantillas con conteo de colaboradores asignados.

**Response 200**:
```json
{
  "plantillas": [
    {
      "id": "uuid",
      "nombre": "Turno Mañana",
      "dias_laborables": ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
      "hora_entrada_esperada": "07:00",
      "colaboradores_count": 12,
      "creado_en": "2026-06-01T10:00:00Z"
    }
  ]
}
```

---

### POST /api/plantillas-horario

Crea una nueva plantilla de horario.

**Request**:
```json
{
  "nombre": "Turno Mañana",
  "dias_laborables": ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
  "hora_entrada_esperada": "07:00"
}
```

**Validaciones**:
- `nombre`: string no vacío, único
- `dias_laborables`: array no vacío, valores en `[LUNES, MARTES, MIERCOLES, JUEVES, VIERNES, SABADO, DOMINGO]`
- `hora_entrada_esperada`: formato `HH:MM` (00:00 – 23:59)

**Response 201**:
```json
{
  "plantilla": {
    "id": "uuid",
    "nombre": "Turno Mañana",
    "dias_laborables": ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
    "hora_entrada_esperada": "07:00",
    "colaboradores_count": 0,
    "creado_en": "2026-06-01T10:00:00Z"
  }
}
```

**Response 409**: `{ "error": "DUPLICATE_NOMBRE", "message": "Ya existe una plantilla con ese nombre." }` si el nombre ya está en uso.

**Side effects**: `INSERT INTO registros_auditoria` con accion `PLANTILLA_HORARIO_CREADA`.

---

### GET /api/plantillas-horario/[id]

Obtiene el detalle de una plantilla incluyendo colaboradores asignados.

**Response 200**:
```json
{
  "plantilla": {
    "id": "uuid",
    "nombre": "Turno Mañana",
    "dias_laborables": ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
    "hora_entrada_esperada": "07:00",
    "creado_en": "2026-06-01T10:00:00Z",
    "colaboradores": [
      { "id": "uuid", "nombre": "Juan", "apellido": "Pérez" }
    ]
  }
}
```

**Response 404**: `{ "error": "NOT_FOUND" }`

---

### PATCH /api/plantillas-horario/[id]

Actualiza una plantilla existente. Todos los campos son opcionales; al menos uno debe estar presente.

**Request** (todos opcionales, al menos uno requerido):
```json
{
  "nombre": "Turno Mañana Modificado",
  "dias_laborables": ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"],
  "hora_entrada_esperada": "06:30"
}
```

**Response 200**:
```json
{
  "plantilla": {
    "id": "uuid",
    "nombre": "Turno Mañana Modificado",
    "dias_laborables": ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"],
    "hora_entrada_esperada": "06:30",
    "colaboradores_count": 12,
    "creado_en": "2026-06-01T10:00:00Z"
  }
}
```

**Response 404**: `{ "error": "NOT_FOUND" }`
**Response 409**: `{ "error": "DUPLICATE_NOMBRE" }` si el nombre nuevo ya está en uso.

**Side effects**: `INSERT INTO registros_auditoria` con accion `PLANTILLA_HORARIO_ACTUALIZADA`, datos_anteriores, datos_nuevos.

---

### DELETE /api/plantillas-horario/[id]

Elimina una plantilla. Rechaza si tiene colaboradores asignados.

**Response 200**: `{ "deleted": true }`

**Response 404**: `{ "error": "NOT_FOUND" }`

**Response 409**:
```json
{
  "error": "PLANTILLA_EN_USO",
  "message": "La plantilla está asignada a 3 colaboradores.",
  "colaboradores": [
    { "id": "uuid", "nombre": "Juan", "apellido": "Pérez" }
  ]
}
```

---

## Colaboradores — Cambios a endpoints existentes

### GET /api/colaboradores (modificado)

Agrega `tarifa_hora_valor` (nullable) a cada entrada del listado.

**Response 200** (fragmento):
```json
{
  "colaboradores": [
    {
      "id": "uuid",
      "nombre": "Juan",
      "apellido": "Pérez",
      "cedula": "12345678",
      "activo": true,
      "area": { "id": "uuid", "nombre": "ACABADO" },
      "tarifa_hora_valor": 15.0
    },
    {
      "id": "uuid",
      "nombre": "María",
      "apellido": "García",
      "cedula": "87654321",
      "activo": true,
      "area": { "id": "uuid", "nombre": "COSTURA" },
      "tarifa_hora_valor": null
    }
  ]
}
```

**Query**: LEFT JOIN LATERAL con `configuraciones_reglas` para `TARIFA_HORA` vigente.

---

### GET /api/colaboradores/[id] (modificado)

Agrega `plantilla_horario` al response existente. El campo `horario_vigente` (UMBRAL_HORA_EXTRA) es removido ya que el umbral de hora extra está fuera de scope de feature 008.

**Response 200** (fragmento nuevos campos):
```json
{
  "plantilla_horario": {
    "id": "uuid",
    "nombre": "Turno Mañana",
    "dias_laborables": ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"],
    "hora_entrada_esperada": "07:00"
  }
}
```

O `"plantilla_horario": null` si no tiene plantilla asignada.

---

### PATCH /api/colaboradores/[id] (modificado)

Agrega campo `plantilla_horario_id` (UUID nullable) al EditSchema.

**Request** (campo adicional):
```json
{
  "plantilla_horario_id": "uuid-de-plantilla"
}
```

O `"plantilla_horario_id": null` para quitar la plantilla.

---

## Tipos TypeScript

```typescript
interface PlantillaHorario {
  id: string;
  nombre: string;
  dias_laborables: string[];  // ['LUNES', 'MARTES', ...]
  hora_entrada_esperada: string;  // 'HH:MM'
  colaboradores_count: number;
  creado_en: string;
}

interface TarifaVigente {
  id: string;
  valor: number;
  unidad: string;
  vigente_desde: string;  // 'YYYY-MM-DD'
}

// Extension to ColaboradorPerfil's PerfilData
interface PerfilData {
  // ... existing fields ...
  tarifa_vigente: TarifaVigente | null;
  plantilla_horario: PlantillaHorario | null;
}
```
