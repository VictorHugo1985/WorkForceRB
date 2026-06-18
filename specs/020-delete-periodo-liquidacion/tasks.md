---

description: "Task list for feature 020: Eliminar Período de Liquidación"
---

# Tasks: Eliminar Período de Liquidación

**Input**: Design documents from `specs/020-delete-periodo-liquidacion/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = P1, US2 = P2)

---

## Phase 3: User Story 1 — Eliminar período sin liquidaciones finalizadas (Priority: P1) 🎯 MVP

**Goal**: ADMINISTRADOR can delete an ABIERTA period that has no APROBADO/PAGADO liquidaciones. The period and all its BORRADOR records are removed atomically, the period disappears from the list, and a success snackbar is shown.

**Independent Test**: Create a period with no approved liquidaciones → click Delete → confirm in dialog → verify period disappears from list and success snackbar appears.

### Implementation for User Story 1

- [X] T001 [P] [US1] Add DELETE handler (checkAdminRole guard, existence check, ABIERTA check, APROBADO/PAGADO count check, transaction cascade delete, audit INSERT) in `apps/web/src/app/api/semanas-laborales/[id]/route.ts`
- [X] T002 [P] [US1] Add DeleteIcon import, deleteTarget state, deletingId state, handleDelete function, DeleteIcon IconButton (isAdmin && ABIERTA only), and confirmation Dialog with period dates and Cancel/Confirmar buttons in `apps/web/src/components/semanas/SemanasListClient.tsx`

**Checkpoint**: After T001 + T002, a DELETE request to `/api/semanas-laborales/[id]` on an eligible period succeeds and the UI shows a success snackbar with the period removed from the list.

---

## Phase 4: User Story 2 — Bloquear eliminación de períodos con liquidaciones finalizadas (Priority: P2)

**Goal**: When a delete is blocked (CERRADA period → 422; APROBADO/PAGADO liquidaciones → 409), the API returns a clear error message and the UI shows it inside the confirmation dialog without removing the period from the list.

**Independent Test**: Approve at least one liquidacion in a period → click Delete → confirm → verify period remains in list and dialog shows the error message.

### Implementation for User Story 2

- [X] T003 [US2] Add deleteError state, Alert component inside delete dialog (showing json.message from 409/422 responses), keep dialog open on error, clear error on dialog close/reopen in `apps/web/src/components/semanas/SemanasListClient.tsx` (depends on T002)

**Checkpoint**: After T003, a blocked delete keeps the period in the list and shows the server's error message inside the open dialog.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T004 Run TypeScript check with `cd apps/web && npx tsc --noEmit` and confirm zero errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **US1 (Phase 3)**: T001 and T002 are independent and can run in parallel (different files)
- **US2 (Phase 4)**: T003 depends on T002 (same file, extends the dialog)
- **Polish (Phase 5)**: T004 depends on T001, T002, and T003 being complete

### User Story Dependencies

- **US1 (P1)**: No prerequisites — T001 and T002 can start immediately
- **US2 (P2)**: Depends on T002 (extends the same dialog component)

### Within Each Phase

- T001 and T002 can run in parallel (different files: route.ts vs SemanasListClient.tsx)
- T003 must follow T002 (extends the same SemanasListClient.tsx dialog)
- T004 must follow T001, T002, T003

---

## Parallel Execution Example

```bash
# Phase 3 — launch both tasks together (different files):
Task T001: "Add DELETE handler in apps/web/src/app/api/semanas-laborales/[id]/route.ts"
Task T002: "Add delete UI in apps/web/src/components/semanas/SemanasListClient.tsx"

# Phase 4 — after T002 completes:
Task T003: "Add error state and Alert in delete dialog (SemanasListClient.tsx)"
```

---

## Implementation Notes

### T001 — DELETE handler in `apps/web/src/app/api/semanas-laborales/[id]/route.ts`

Add after the existing `GET` export:

```ts
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await checkAdminRole(req);          // checkAdminRole must be imported from @/lib/auth-server
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Existence check
    const row = await client.query(
      `SELECT id, estado, fecha_inicio, fecha_fin FROM liquidacion_periodo WHERE id = $1`,
      [id],
    );
    if (row.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Período no encontrado' }, { status: 404 });
    }
    const periodo = row.rows[0];

    // 2. ABIERTA check
    if (periodo.estado !== 'ABIERTA') {
      await client.query('ROLLBACK');
      return NextResponse.json({ message: 'Los períodos cerrados no pueden eliminarse.' }, { status: 422 });
    }

    // 3. Eligibility check (no APROBADO/PAGADO)
    const blocked = await client.query(
      `SELECT COUNT(*) FROM liquidacion_colaborador WHERE semana_id = $1 AND estado IN ('APROBADO', 'PAGADO')`,
      [id],
    );
    if (parseInt(blocked.rows[0].count, 10) > 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { message: 'El período tiene liquidaciones aprobadas o pagadas y no puede eliminarse.' },
        { status: 409 },
      );
    }

    // 4. Cascade delete
    await client.query(
      `DELETE FROM dias_liquidacion WHERE liquidacion_id IN (SELECT id FROM liquidacion_colaborador WHERE semana_id = $1)`,
      [id],
    );
    await client.query(`DELETE FROM liquidacion_colaborador WHERE semana_id = $1`, [id]);
    await client.query(`DELETE FROM bonos WHERE semana_id = $1`, [id]);
    await client.query(`DELETE FROM liquidacion_periodo WHERE id = $1`, [id]);

    // 5. Audit (non-blocking — best effort)
    try {
      await client.query(
        `INSERT INTO registros_auditoria (accion, entidad_tipo, entidad_id, datos_anteriores, usuario_id, creado_en)
         VALUES ('PERIODO_ELIMINADO', 'LiquidacionPeriodo', $1, $2, $3, NOW())`,
        [id, JSON.stringify({ fecha_inicio: periodo.fecha_inicio, fecha_fin: periodo.fecha_fin }), auth.userId],
      );
    } catch { /* audit failure does not abort the delete */ }

    await client.query('COMMIT');
    return NextResponse.json({});
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

**Key import to add**: `checkAdminRole` from `@/lib/auth-server` (already imported for other routes in the codebase).

Note: `checkAdminRole` returns `{ userId: string }` on success — use `auth.userId` for the audit INSERT.

---

### T002 — Delete button + dialog (success path) in `apps/web/src/components/semanas/SemanasListClient.tsx`

1. Add import: `DeleteIcon from '@mui/icons-material/Delete'`
2. Add state inside component:
   ```ts
   const [deleteTarget, setDeleteTarget] = useState<SemanaLaboral | null>(null);
   const [deletingId, setDeletingId] = useState<string | null>(null);
   ```
3. Add `handleDelete` function:
   ```ts
   const handleDelete = async () => {
     if (!deleteTarget) return;
     setDeletingId(deleteTarget.id);
     try {
       const res = await fetch(`/api/semanas-laborales/${deleteTarget.id}`, { method: 'DELETE' });
       if (res.ok) {
         setSemanas((prev) => prev.filter((s) => s.id !== deleteTarget.id));
         setDeleteTarget(null);
         showSuccess('Período eliminado correctamente.');
       } else {
         const json = await res.json().catch(() => ({}));
         // T003 extends this branch to show deleteError in dialog
       }
     } catch {
       // T003 extends this branch
     } finally {
       setDeletingId(null);
     }
   };
   ```
4. In the actions `TableCell`, add after the existing LockIcon button:
   ```tsx
   {isAdmin && s.estado === 'ABIERTA' && (
     <Tooltip title="Eliminar período">
       <IconButton size="small" onClick={() => setDeleteTarget(s)}>
         <DeleteIcon fontSize="small" />
       </IconButton>
     </Tooltip>
   )}
   ```
5. Add confirmation Dialog (after the existing create Dialog):
   ```tsx
   <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
     <DialogTitle>Eliminar período</DialogTitle>
     <DialogContent>
       <Typography>
         ¿Eliminar el período{' '}
         <strong>
           {deleteTarget ? `${formatDate(deleteTarget.fecha_inicio)} – ${formatDate(deleteTarget.fecha_fin)}` : ''}
         </strong>
         ? Esta acción no se puede deshacer.
       </Typography>
     </DialogContent>
     <DialogActions>
       <Button onClick={() => setDeleteTarget(null)} disabled={!!deletingId}>Cancelar</Button>
       <Button color="error" variant="contained" onClick={handleDelete} disabled={!!deletingId}>
         Eliminar
       </Button>
     </DialogActions>
   </Dialog>
   ```

---

### T003 — Error state + Alert in delete dialog in `apps/web/src/components/semanas/SemanasListClient.tsx`

1. Add state: `const [deleteError, setDeleteError] = useState<string | null>(null);`
2. In `handleDelete`, replace the error branches:
   ```ts
   const json = await res.json().catch(() => ({}));
   setDeleteError(json?.message ?? `Error ${res.status}`);
   showError(json?.message ?? 'No se pudo eliminar el período.');
   // ...and in catch:
   setDeleteError('Error de red. Intente de nuevo.');
   showError('Error de red. Intente de nuevo.');
   ```
3. Clear error on dialog close — update `onClose` of delete Dialog:
   ```tsx
   onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
   ```
4. Add Alert inside DialogContent (above the Typography):
   ```tsx
   {deleteError && <Alert severity="error" sx={{ mb: 2 }}>{deleteError}</Alert>}
   ```
5. Clear `deleteError` when opening dialog (optional — it's reset on close, which is sufficient).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 and T002 in parallel (different files)
2. **VALIDATE**: Test US1 — create a period, delete it, verify success
3. Complete T003 (US2 error display)
4. **VALIDATE**: Test US2 — attempt blocked delete, verify error in dialog
5. Complete T004 (TypeScript check)

### Notes

- No schema migration required
- No new npm packages required (`DeleteIcon` is already in `@mui/icons-material` which is installed)
- `checkAdminRole` is already used in other API routes — confirm its import path is `@/lib/auth-server`
- `checkAdminRole` returns `{ userId: string }` — use `auth.userId` in the audit INSERT (verified in `apps/web/src/lib/auth-server.ts:113`)
