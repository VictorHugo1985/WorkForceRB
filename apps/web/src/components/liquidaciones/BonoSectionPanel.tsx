'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { BonoData, useLiquidacionStore } from '@/stores/liquidacion.store';

interface Props {
  semanaId: string;
  colaboradorId: string;
  fechaInicio: string;
  fechaFin: string;
}

const TIPO_COLORS: Record<string, 'primary' | 'secondary' | 'default'> = {
  TRANSPORTE: 'primary',
  ALIMENTACION: 'secondary',
  GENERICO: 'default',
};

function formatFecha(iso: string) {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

interface BonoFormData {
  fechaDia: string;
  tipo: string;
  monto: string;
  comentario: string;
}

const emptyForm: BonoFormData = { fechaDia: '', tipo: 'TRANSPORTE', monto: '', comentario: '' };

export function BonoSectionPanel({ semanaId, colaboradorId, fechaInicio, fechaFin }: Props) {
  const { liquidacion, applyOptimisticTotales, reconcileTotales } = useLiquidacionStore();
  const setLiquidacion = useLiquidacionStore((s) => s.setLiquidacion);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BonoFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ monto: string; comentario: string }>({ monto: '', comentario: '' });
  const [editError, setEditError] = useState<string | null>(null);

  if (!liquidacion) return null;
  const isAprobado = liquidacion.estado === 'APROBADO';

  const bonos = [...liquidacion.bonos].sort((a, b) => a.fechaDia.localeCompare(b.fechaDia));

  const handleAdd = async () => {
    setFormError(null);
    if (!form.fechaDia || !form.tipo || !form.monto || !form.comentario) {
      setFormError('Todos los campos son requeridos');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/bonos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaboradorId,
          semanaId,
          fechaDia: form.fechaDia,
          tipo: form.tipo,
          monto: parseFloat(form.monto),
          comentario: form.comentario,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json?.message ?? `Error ${res.status}`);
        return;
      }
      // Update store with new bono + recalculated totals
      if (liquidacion && json.bono) {
        setLiquidacion({
          ...liquidacion,
          bonos: [...liquidacion.bonos, json.bono],
          ...(json.totales ?? {}),
        });
      }
      setForm(emptyForm);
      setShowForm(false);
    } catch {
      setFormError('Error de red. Intente de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (bono: BonoData) => {
    if (!confirm(`¿Eliminar bono de ${bono.tipo} (${bono.monto} Bs.) del ${formatFecha(bono.fechaDia)}?`)) return;
    const prevBonos = liquidacion.bonos;
    // Optimistic remove
    setLiquidacion({ ...liquidacion, bonos: liquidacion.bonos.filter((b) => b.id !== bono.id) });
    try {
      const res = await fetch(`/api/bonos/${bono.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setLiquidacion({ ...liquidacion, bonos: prevBonos });
        return;
      }
      const json = await res.json();
      if (json.totales) reconcileTotales(json.totales);
    } catch {
      setLiquidacion({ ...liquidacion, bonos: prevBonos });
    }
  };

  const handleEditSave = async (id: string) => {
    setEditError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.monto) body.monto = parseFloat(editForm.monto);
      if (editForm.comentario) body.comentario = editForm.comentario;
      const res = await fetch(`/api/bonos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setEditError(json?.message ?? `Error ${res.status}`);
        return;
      }
      if (liquidacion && json.bono) {
        setLiquidacion({
          ...liquidacion,
          bonos: liquidacion.bonos.map((b) => (b.id === id ? json.bono : b)),
          ...(json.totales ?? {}),
        });
      }
      setEditingId(null);
    } catch {
      setEditError('Error de red.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
          Bonos
        </Typography>
        {!isAprobado && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setShowForm(!showForm)}
            variant="outlined"
          >
            Agregar bono
          </Button>
        )}
      </Box>

      <Collapse in={showForm}>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <TextField
              label="Fecha"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: fechaInicio.slice(0, 10), max: fechaFin.slice(0, 10) } }}
              value={form.fechaDia}
              onChange={(e) => setForm({ ...form, fechaDia: e.target.value })}
              sx={{ width: 160 }}
            />
            <FormControl size="small" sx={{ width: 180 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                <MenuItem value="TRANSPORTE">Transporte</MenuItem>
                <MenuItem value="ALIMENTACION">Alimentación</MenuItem>
                <MenuItem value="GENERICO">Genérico</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Monto (Bs.)"
              type="number"
              size="small"
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              sx={{ width: 140 }}
            />
            <TextField
              label="Comentario"
              size="small"
              value={form.comentario}
              onChange={(e) => setForm({ ...form, comentario: e.target.value })}
              sx={{ flexGrow: 1, minWidth: 200 }}
            />
            <Button variant="contained" size="small" onClick={handleAdd} disabled={submitting}>
              Guardar
            </Button>
            <Button size="small" onClick={() => { setShowForm(false); setFormError(null); }}>
              Cancelar
            </Button>
          </Box>
        </Box>
      </Collapse>

      {bonos.length === 0 ? (
        <Typography color="text.secondary" variant="body2">
          Sin bonos registrados esta semana.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Monto</TableCell>
              <TableCell>Comentario</TableCell>
              {!isAprobado && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {bonos.map((bono) => (
              <TableRow key={bono.id}>
                <TableCell>{formatFecha(bono.fechaDia)}</TableCell>
                <TableCell>
                  <Chip
                    label={bono.tipo}
                    size="small"
                    color={TIPO_COLORS[bono.tipo] ?? 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  {editingId === bono.id ? (
                    <TextField
                      size="small"
                      type="number"
                      slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
                      value={editForm.monto}
                      onChange={(e) => setEditForm({ ...editForm, monto: e.target.value })}
                      sx={{ width: 100 }}
                    />
                  ) : (
                    `${Number(bono.monto).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`
                  )}
                </TableCell>
                <TableCell>
                  {editingId === bono.id ? (
                    <Box>
                      {editError && <Alert severity="error" sx={{ mb: 1 }}>{editError}</Alert>}
                      <TextField
                        size="small"
                        value={editForm.comentario}
                        onChange={(e) => setEditForm({ ...editForm, comentario: e.target.value })}
                        fullWidth
                      />
                    </Box>
                  ) : (
                    bono.comentario.length > 40 ? `${bono.comentario.slice(0, 40)}…` : bono.comentario
                  )}
                </TableCell>
                {!isAprobado && (
                  <TableCell>
                    {editingId === bono.id ? (
                      <>
                        <Button size="small" onClick={() => handleEditSave(bono.id)} disabled={submitting}>
                          OK
                        </Button>
                        <Button size="small" onClick={() => setEditingId(null)}>
                          ✕
                        </Button>
                      </>
                    ) : (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingId(bono.id);
                            setEditForm({ monto: String(bono.monto), comentario: bono.comentario });
                            setEditError(null);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(bono)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
