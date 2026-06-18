# API Contracts: Attendance Dashboard

## GET /api/dashboard/asistencia

Returns attendance data grouped by area for the given date range and optional collaborador filter.

**Authentication**: Required (session cookie). Roles: `ADMINISTRADOR`, `SUPERVISOR`.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fecha_desde` | `YYYY-MM-DD` | No | Start date (defaults to today in Bolivia time) |
| `fecha_hasta` | `YYYY-MM-DD` | No | End date (defaults to today in Bolivia time) |
| `colaborador` | string | No | Partial name, surname, or cédula for filtering |

### Response `200 OK`

```json
{
  "fechaDesde": "2026-06-08",
  "fechaHasta": "2026-06-08",
  "areas": [
    {
      "areaId": "uuid-or-null",
      "areaNombre": "Administración",
      "colaboradores": [
        {
          "id": "uuid",
          "nombre": "Ana",
          "apellido": "García",
          "dias": [
            {
              "fecha": "2026-06-08",
              "marcaciones": ["08:02", "12:30", "13:15", "17:45"]
            }
          ]
        },
        {
          "id": "uuid",
          "nombre": "Luis",
          "apellido": "Pérez",
          "dias": []
        }
      ]
    },
    {
      "areaId": null,
      "areaNombre": "Sin área",
      "colaboradores": []
    }
  ]
}
```

### Response semantics

- `dias: []` means the collaborador had zero marcaciones in the requested period → **absent**.
- `dias` with one or more entries means **present** on those dates.
- All active collaboradores appear in the response regardless of attendance. The query uses a LEFT JOIN.
- Areas are ordered alphabetically; `"Sin área"` appears last.
- **Single-day query** (`fecha_desde === fecha_hasta`): collaboradores within each area are ordered by their first marcacion time ascending (earliest arrival first). Collaboradores with no marcaciones appear at the end, sorted alphabetically by `apellido, nombre`.
- **Multi-day query**: collaboradores within each area are ordered alphabetically by `apellido, nombre`.
- For a multi-day query, each `dias` entry is one calendar day with marcaciones. The frontend aggregates "X/Y días" counts from `dias.length`.

### Error Responses

| Status | Body | Condition |
|--------|------|-----------|
| 401 | `{ "error": "UNAUTHORIZED" }` | No session cookie, invalid token, or blacklisted JTI |
| 403 | `{ "error": "FORBIDDEN" }` | Authenticated but role is not ADMINISTRADOR or SUPERVISOR |

---

## No write endpoints

The attendance dashboard is entirely read-only. No POST/PATCH/DELETE endpoints are defined for this feature.
