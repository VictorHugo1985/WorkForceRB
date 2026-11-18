---

description: "Task list for feature 021: Configuración de Relojes Biométricos"
---

# Tasks: Configuración de Relojes Biométricos

**Input**: Design documents from `specs/021-biometric-clock-config/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks grouped by user story. T001–T004 are shared infrastructure (all [P] in pairs). T005–T006 form the MVP. T007 and T008 extend the same client component sequentially.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add sidebar entry and icon — unblocks page navigation for all user stories.

- [X] T001 [P] Add `{ label: 'Configuración Reloj', href: '/relojes', roles: ['ADMINISTRADOR'] }` to NAV_ITEMS and `'/relojes': ['ADMINISTRADOR']` to ROUTE_ROLES in `apps/web/src/lib/nav-config.ts`
- [X] T002 [P] Import `AccessTimeIcon from '@mui/icons-material/AccessTime'` and add `'/relojes': <AccessTimeIcon fontSize="small" />` to NAV_ICONS in `apps/web/src/components/layout/AppSidebar.tsx`

**Checkpoint**: Sidebar shows "Configuración Reloj" for ADMINISTRADOR. Clicking navigates to `/relojes` (will 404 until T006 is done).

---

## Phase 2: Foundational API (Blocking Prerequisites)

**Purpose**: API routes that all user stories depend on.

- [X] T003 [P] Rewrite GET handler (all devices + all fields + `tiene_webhook_secreto` boolean, no `webhook_secreto`) and add POST handler (Zod validation, unique serial check, audit INSERT) in `apps/web/src/app/api/dispositivos/route.ts`
- [X] T004 [P] Create new file `apps/web/src/app/api/dispositivos/[id]/route.ts` with PATCH handler (existence check, optional fields update, tipo→CSV clears secret, empty webhook_secreto preserves existing, activo toggle, unique serial check, audit INSERT)

**Checkpoint**: `GET /api/dispositivos` returns all fields. `POST /api/dispositivos` creates a device. `PATCH /api/dispositivos/[id]` edits or toggles active state.

---

## Phase 3: User Story 1 — Ver y registrar relojes biométricos (Priority: P1) 🎯 MVP

**Goal**: ADMINISTRADOR navigates to "Configuración Reloj", sees a list of all devices, and can register a new one via a form dialog.

**Independent Test**: Navigate to `/relojes` → verify list loads → click "Nuevo Reloj" → fill form → save → verify new device appears in list.

### Implementation for User Story 1

- [X] T005 [US1] Create client component `apps/web/src/components/relojes/RelojesListClient.tsx` with: `DispositivoRow` interface, list Table (nombre, numero_serie, tipo Chip, secreto indicator, activo Chip, acciones column), "Nuevo Reloj" Button (isAdmin only), create Dialog (nombre TextField, numero_serie TextField optional, tipo Select WEBHOOK/CSV, webhook_secreto TextField conditional on tipo=WEBHOOK), `handleCreate` function calling `POST /api/dispositivos`, success snackbar, error Alert inside dialog
- [X] T006 [US1] Create server page `apps/web/src/app/(app)/relojes/page.tsx`: verify ADMINISTRADOR role (redirect to /login if not), query `SELECT id, nombre, numero_serie, tipo, activo, (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto, creado_en, actualizado_en FROM dispositivos_biometricos ORDER BY nombre`, render `<RelojesListClient dispositivos={rows} isAdmin={true} />`

**Checkpoint**: Full US1 flow works end-to-end. List loads. New device can be created. Duplicate serial rejected with error in dialog.

---

## Phase 4: User Story 2 — Modificar datos de un reloj existente (Priority: P2)

**Goal**: ADMINISTRADOR edits a device's name, serial, type, or webhook secret from the list.

**Independent Test**: Click edit on a device → change its name → save → verify list shows updated name.

### Implementation for User Story 2

- [X] T007 [US2] Add to `apps/web/src/components/relojes/RelojesListClient.tsx`: `editTarget` state (`DispositivoRow | null`), `editError` state, edit Dialog (pre-filled with current values; webhook_secreto field shows empty — hint "Dejar vacío para conservar el secreto actual"; fields: nombre, numero_serie, tipo, webhook_secreto conditional), `handleEdit` function calling `PATCH /api/dispositivos/[id]`, update device in list state on success, edit IconButton (EditIcon) in actions column (isAdmin only)

**Checkpoint**: Editing a device's name/serial/type updates the list immediately. Duplicate serial rejected. Changing tipo to CSV shows no secret field.

---

## Phase 5: User Story 3 — Inactivar / reactivar un reloj (Priority: P3)

**Goal**: ADMINISTRADOR can inactivate an active device or reactivate an inactive one directly from the list.

**Independent Test**: Click inactivate on an active device → confirm → verify Chip changes to "Inactivo". Click activate → verify it returns to "Activo".

### Implementation for User Story 3

- [X] T008 [US3] Add to `apps/web/src/components/relojes/RelojesListClient.tsx`: `togglingId` state (`string | null`), `handleToggleActive` function calling `PATCH /api/dispositivos/[id]` with `{ activo: !current }`, update device activo in list state on success, toggle IconButton in actions column — shows `LockOpenIcon` (inactivate) when activo=true and `LockIcon` (reactivate) when activo=false (isAdmin only), Tooltip with "Inactivar" / "Activar"

**Checkpoint**: Activo state toggles immediately in the list. Chip color changes (success=Activo, default=Inactivo).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 Run TypeScript check with `cd apps/web && npx tsc --noEmit` and confirm zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 run in parallel — no dependencies
- **Foundational API (Phase 2)**: T003 and T004 run in parallel — no dependencies on Phase 1 (API routes are independent of nav config)
- **US1 (Phase 3)**: Depends on Phase 2 API being complete (T003 for GET+POST). T005 before T006 (page imports component)
- **US2 (Phase 4)**: Depends on T005 (extends same file) and T004 (PATCH endpoint)
- **US3 (Phase 5)**: Depends on T007 (extends same file) and T004 (PATCH endpoint)
- **Polish (Phase 6)**: Depends on all above

### Parallel Opportunities

- T001 ‖ T002 (different files: nav-config.ts vs AppSidebar.tsx)
- T003 ‖ T004 (different files: route.ts vs [id]/route.ts)
- Phase 1 and Phase 2 can all run in parallel (4 different files)

---

## Implementation Notes

### T001 — `apps/web/src/lib/nav-config.ts`

```ts
// In NAV_ITEMS array, add before 'Semanas Laborales' entry or at end of admin items:
{ label: 'Configuración Reloj', href: '/relojes', roles: ['ADMINISTRADOR'] },

// In ROUTE_ROLES, add:
'/relojes': ['ADMINISTRADOR'],
```

### T002 — `apps/web/src/components/layout/AppSidebar.tsx`

```ts
// Add import (with other icon imports):
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// Add to NAV_ICONS:
'/relojes': <AccessTimeIcon fontSize="small" />,
```

### T003 — `apps/web/src/app/api/dispositivos/route.ts`

Replace the file entirely:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const CreateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  numero_serie: z.string().optional(),
  tipo: z.enum(['WEBHOOK', 'CSV']),
  webhook_secreto: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, nombre, numero_serie, tipo, activo,
              (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto,
              creado_en, actualizado_en
       FROM dispositivos_biometricos ORDER BY nombre`,
    );
    return NextResponse.json({ dispositivos: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });

  const { nombre, numero_serie, tipo, webhook_secreto } = parsed.data;

  if (tipo === 'WEBHOOK' && !webhook_secreto?.trim()) {
    return NextResponse.json(
      { message: 'El secreto webhook es requerido para dispositivos de tipo WEBHOOK.' },
      { status: 400 },
    );
  }

  const client = await pool.connect();
  try {
    if (numero_serie) {
      const dup = await client.query(
        `SELECT id FROM dispositivos_biometricos WHERE numero_serie = $1 LIMIT 1`,
        [numero_serie],
      );
      if (dup.rows.length > 0) {
        return NextResponse.json({ message: 'Ya existe un dispositivo con ese número de serie.' }, { status: 409 });
      }
    }

    const res = await client.query(
      `INSERT INTO dispositivos_biometricos (nombre, numero_serie, tipo, webhook_secreto)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, numero_serie, tipo, activo,
                 (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto,
                 creado_en, actualizado_en`,
      [nombre, numero_serie ?? null, tipo, tipo === 'WEBHOOK' ? (webhook_secreto ?? null) : null],
    );
    const row = res.rows[0];

    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, descripcion, datos_nuevos)
         VALUES ('RELOJ_REGISTRADO', 'DispositivoBiometrico', $1, $2, $3, $4)`,
        [row.id, auth.userId, `Registro de reloj biométrico: ${nombre}`,
         JSON.stringify({ nombre, numero_serie: numero_serie ?? null, tipo })],
      );
    } catch { /* audit non-blocking */ }

    return NextResponse.json(row, { status: 201 });
  } finally {
    client.release();
  }
}
```

### T004 — `apps/web/src/app/api/dispositivos/[id]/route.ts` (new file)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { pool, checkAdminRole } from '@/lib/auth-server';

const PatchSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  numero_serie: z.string().nullable().optional(),
  tipo: z.enum(['WEBHOOK', 'CSV']).optional(),
  webhook_secreto: z.string().optional(),
  activo: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 400 });

  const { nombre, numero_serie, tipo, webhook_secreto, activo } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      `SELECT id, nombre, numero_serie, tipo, activo, webhook_secreto
       FROM dispositivos_biometricos WHERE id = $1`,
      [id],
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ message: 'Dispositivo no encontrado' }, { status: 404 });
    }
    const prev = existing.rows[0];

    const newSerial = numero_serie !== undefined ? numero_serie : prev.numero_serie;
    if (newSerial && newSerial !== prev.numero_serie) {
      const dup = await client.query(
        `SELECT id FROM dispositivos_biometricos WHERE numero_serie = $1 AND id != $2 LIMIT 1`,
        [newSerial, id],
      );
      if (dup.rows.length > 0) {
        return NextResponse.json({ message: 'Ya existe un dispositivo con ese número de serie.' }, { status: 409 });
      }
    }

    const newTipo = tipo ?? prev.tipo;
    let newSecret = prev.webhook_secreto;
    if (newTipo === 'CSV') {
      newSecret = null;
    } else if (webhook_secreto && webhook_secreto.trim() !== '') {
      newSecret = webhook_secreto;
    }

    const res = await client.query(
      `UPDATE dispositivos_biometricos
       SET nombre = $1, numero_serie = $2, tipo = $3, webhook_secreto = $4, activo = $5
       WHERE id = $6
       RETURNING id, nombre, numero_serie, tipo, activo,
                 (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto,
                 actualizado_en`,
      [nombre ?? prev.nombre, newSerial, newTipo, newSecret, activo ?? prev.activo, id],
    );
    const row = res.rows[0];

    let accion = 'RELOJ_MODIFICADO';
    if (activo !== undefined && activo !== prev.activo) {
      accion = activo ? 'RELOJ_ACTIVADO' : 'RELOJ_INACTIVADO';
    }

    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, usuario_id, datos_anteriores, datos_nuevos)
         VALUES ($1, 'DispositivoBiometrico', $2, $3, $4, $5)`,
        [accion, id, auth.userId,
         JSON.stringify({ nombre: prev.nombre, numero_serie: prev.numero_serie, tipo: prev.tipo, activo: prev.activo }),
         JSON.stringify({ nombre: row.nombre, numero_serie: row.numero_serie, tipo: row.tipo, activo: row.activo })],
      );
    } catch { /* audit non-blocking */ }

    return NextResponse.json(row);
  } finally {
    client.release();
  }
}
```

### T005 — `apps/web/src/components/relojes/RelojesListClient.tsx` (new file)

```tsx
'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import KeyIcon from '@mui/icons-material/Key';
import { PageHeader } from '@/components/ui/PageHeader';
import { useSnackbar } from '@/lib/SnackbarContext';

interface DispositivoRow {
  id: string;
  nombre: string;
  numero_serie: string | null;
  tipo: 'WEBHOOK' | 'CSV';
  activo: boolean;
  tiene_webhook_secreto: boolean;
  creado_en: string;
  actualizado_en: string;
}

interface Props {
  dispositivos: DispositivoRow[];
  isAdmin: boolean;
}

export function RelojesListClient({ dispositivos: initial, isAdmin }: Props) {
  const { showSuccess, showError } = useSnackbar();
  const [dispositivos, setDispositivos] = useState<DispositivoRow[]>(initial);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [tipo, setTipo] = useState<'WEBHOOK' | 'CSV'>('WEBHOOK');
  const [webhookSecreto, setWebhookSecreto] = useState('');

  const handleCreate = async () => {
    setCreateError(null);
    if (!nombre.trim()) { setCreateError('El nombre es requerido'); return; }
    if (tipo === 'WEBHOOK' && !webhookSecreto.trim()) { setCreateError('El secreto webhook es requerido'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/dispositivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          numero_serie: numeroSerie.trim() || undefined,
          tipo,
          webhook_secreto: tipo === 'WEBHOOK' ? webhookSecreto : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json?.message ?? `Error ${res.status}`); return; }
      setDispositivos((prev) => [...prev, json]);
      setCreateOpen(false);
      setNombre(''); setNumeroSerie(''); setTipo('WEBHOOK'); setWebhookSecreto('');
      showSuccess('Reloj biométrico registrado.');
    } catch {
      setCreateError('Error de red. Intente de nuevo.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Configuración Reloj"
        action={
          isAdmin ? (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
              Nuevo Reloj
            </Button>
          ) : undefined
        }
      />

      {dispositivos.length === 0 ? (
        <Typography color="text.secondary">No hay relojes biométricos registrados.</Typography>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>N.º de serie</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Secreto</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dispositivos.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{d.nombre}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{d.numero_serie ?? '—'}</TableCell>
                  <TableCell>
                    <Chip label={d.tipo} size="small" color={d.tipo === 'WEBHOOK' ? 'primary' : 'default'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {d.tiene_webhook_secreto && (
                      <Tooltip title="Secreto webhook configurado">
                        <KeyIcon fontSize="small" sx={{ color: 'text.secondary', verticalAlign: 'middle' }} />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.activo
                      ? <Chip label="Activo" size="small" color="success" />
                      : <Chip label="Inactivo" size="small" color="default" />}
                  </TableCell>
                  <TableCell align="right">
                    {/* Edit and toggle buttons added in T007 and T008 */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); setCreateError(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Nuevo Reloj Biométrico</DialogTitle>
        <DialogContent>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Nombre" size="small" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <TextField label="Número de serie" size="small" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} helperText="Opcional" />
            <FormControl size="small" fullWidth>
              <InputLabel>Tipo de integración</InputLabel>
              <Select label="Tipo de integración" value={tipo} onChange={(e) => setTipo(e.target.value as 'WEBHOOK' | 'CSV')}>
                <MenuItem value="WEBHOOK">WEBHOOK (tiempo real)</MenuItem>
                <MenuItem value="CSV">CSV (importación manual)</MenuItem>
              </Select>
            </FormControl>
            {tipo === 'WEBHOOK' && (
              <TextField label="Secreto webhook" size="small" type="password" value={webhookSecreto} onChange={(e) => setWebhookSecreto(e.target.value)} required />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateOpen(false); setCreateError(null); }} disabled={creating}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

### T006 — `apps/web/src/app/(app)/relojes/page.tsx` (new file)

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { RelojesListClient } from '@/components/relojes/RelojesListClient';

export default async function RelojesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  try {
    const payload = await verifyToken(token!);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
    if (!payload.roles.includes('ADMINISTRADOR')) redirect('/dashboard');
  } catch {
    redirect('/login?reason=expired');
  }

  let dispositivos: {
    id: string; nombre: string; numero_serie: string | null;
    tipo: 'WEBHOOK' | 'CSV'; activo: boolean; tiene_webhook_secreto: boolean;
    creado_en: string; actualizado_en: string;
  }[] = [];

  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, nombre, numero_serie, tipo, activo,
                (webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto,
                creado_en::text, actualizado_en::text
         FROM dispositivos_biometricos ORDER BY nombre`,
      );
      dispositivos = res.rows;
    } finally {
      client.release();
    }
  } catch {
    /* show empty state */
  }

  return <RelojesListClient dispositivos={dispositivos} isAdmin={true} />;
}
```

### T007 — Edit dialog additions to `apps/web/src/components/relojes/RelojesListClient.tsx`

1. Add `EditIcon from '@mui/icons-material/Edit'` import
2. Add state inside component:
   ```ts
   const [editTarget, setEditTarget] = useState<DispositivoRow | null>(null);
   const [editError, setEditError] = useState<string | null>(null);
   const [editing, setEditing] = useState(false);
   const [editNombre, setEditNombre] = useState('');
   const [editNumeroSerie, setEditNumeroSerie] = useState('');
   const [editTipo, setEditTipo] = useState<'WEBHOOK' | 'CSV'>('WEBHOOK');
   const [editSecreto, setEditSecreto] = useState('');
   ```
3. Add `handleOpenEdit` function that sets editTarget and pre-fills form fields from `d` (the device row):
   ```ts
   const handleOpenEdit = (d: DispositivoRow) => {
     setEditTarget(d);
     setEditNombre(d.nombre);
     setEditNumeroSerie(d.numero_serie ?? '');
     setEditTipo(d.tipo);
     setEditSecreto('');
     setEditError(null);
   };
   ```
4. Add `handleEdit` async function calling `PATCH /api/dispositivos/[editTarget.id]` with `{ nombre, numero_serie, tipo, webhook_secreto }` — on success, update the device in state and show success snackbar; on error, set `editError`.
5. Add `EditIcon` IconButton in the actions TableCell (isAdmin only): `onClick={() => handleOpenEdit(d)}`
6. Add edit Dialog after the create Dialog — same structure but pre-filled, `webhook_secreto` shows helperText "Dejar vacío para conservar el secreto actual".

### T008 — Toggle active additions to `apps/web/src/components/relojes/RelojesListClient.tsx`

1. Add imports: `LockIcon from '@mui/icons-material/Lock'`, `LockOpenIcon from '@mui/icons-material/LockOpen'`
2. Add state: `const [togglingId, setTogglingId] = useState<string | null>(null);`
3. Add `handleToggleActive` async function:
   ```ts
   const handleToggleActive = async (d: DispositivoRow) => {
     setTogglingId(d.id);
     try {
       const res = await fetch(`/api/dispositivos/${d.id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ activo: !d.activo }),
       });
       if (res.ok) {
         const json = await res.json();
         setDispositivos((prev) => prev.map((r) => r.id === d.id ? { ...r, activo: json.activo } : r));
         showSuccess(d.activo ? 'Reloj inactivado.' : 'Reloj activado.');
       } else {
         const json = await res.json().catch(() => ({}));
         showError(json?.message ?? 'No se pudo cambiar el estado.');
       }
     } catch {
       showError('Error de red. Intente de nuevo.');
     } finally {
       setTogglingId(null);
     }
   };
   ```
4. Add toggle IconButton in actions TableCell (isAdmin only, `disabled={togglingId === d.id}`):
   - When `d.activo === true`: `<LockOpenIcon />` with Tooltip "Inactivar"
   - When `d.activo === false`: `<LockIcon />` with Tooltip "Activar"

---

## Parallel Execution Example

```bash
# All 4 setup + foundational tasks in parallel (all different files):
T001: nav-config.ts (add /relojes)
T002: AppSidebar.tsx (add AccessTimeIcon)
T003: apps/web/src/app/api/dispositivos/route.ts (rewrite GET + add POST)
T004: apps/web/src/app/api/dispositivos/[id]/route.ts (new PATCH)

# Then sequentially:
T005 → T006 (T006 imports T005)
T007 (extends T005 file)
T008 (extends T005 file after T007)
T009 (tsc --noEmit)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete T001–T004 in parallel (4 files, no conflicts)
2. Complete T005 (client component — list + create dialog)
3. Complete T006 (server page — imports T005)
4. **VALIDATE**: Navigate to `/relojes`, create a device, verify it appears
5. Complete T007 (edit dialog)
6. Complete T008 (toggle active)
7. Complete T009 (TypeScript check)

### Notes

- No schema migration required
- `tiene_webhook_secreto` computed in SQL: `(webhook_secreto IS NOT NULL AND webhook_secreto <> '') AS tiene_webhook_secreto`
- Existing consumers of `GET /api/dispositivos` (collaborator form dropdown) only use `id` and `nombre` — the expanded response is backward compatible
- `checkAdminRole` returns `{ userId: string }` — use `auth.userId` in audit INSERTs
