'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useLiquidacionStore, DiaLiquidacionData } from '@/stores/liquidacion.store';
import { DiaAjusteDialog } from './DiaAjusteDialog';

function formatFecha(iso: string) {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function estadoDiaChip(estado: string) {
  switch (estado) {
    case 'APROBADO':
      return <Chip label="Aprobado" size="small" color="success" />;
    case 'CON_AJUSTE_HORAS':
      return <Chip label="H. ajustadas" size="small" color="info" />;
    case 'CON_DESCUENTO':
      return <Chip label="Con descuento" size="small" color="warning" />;
    case 'CON_AJUSTE_Y_DESCUENTO':
      return <Chip label="Ajuste + Desc." size="small" color="warning" />;
    default:
      return <Chip label="Sin rev." size="small" />;
  }
}

function descuentoLabel(tipo: string | null, valor: number | null) {
  if (!tipo) return '—';
  if (tipo === 'TARIFA_DIA') return `Tarifa fija${valor != null ? `: ${valor} Bs./h` : ''}`;
  if (tipo === 'MONTO_FIJO') return `Monto fijo${valor != null ? `: ${valor} Bs.` : ''}`;
  return tipo;
}

const OMIT_MOTIVOS = ['Duplicada', 'Error de registro', 'Otro'] as const;

export function DiaLiquidacionTable() {
  const liquidacion = useLiquidacionStore((s) => s.liquidacion);
  const { reconcileDia, applyOptimisticTotales } = useLiquidacionStore();
  const [dialogDia, setDialogDia] = useState<DiaLiquidacionData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pendingOmit, setPendingOmit] = useState<{ diaId: string; punchIso: string; motivo: string } | null>(null);
  const [omitLoading, setOmitLoading] = useState(false);

  if (!liquidacion) return null;

  const isAprobado = liquidacion.estado === 'APROBADO';

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const patchDia = async (diaId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/dias-liquidacion/${diaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ dia: DiaLiquidacionData; totales: Record<string, number> }>;
  };

  const handleConfirmOmit = async () => {
    if (!pendingOmit) return;
    const dia = liquidacion.dias.find((d) => d.id === pendingOmit.diaId);
    if (!dia) return;
    setOmitLoading(true);
    const newExcluded = [...(dia.marcacionesExcluidas ?? []), pendingOmit.punchIso];
    const result = await patchDia(pendingOmit.diaId, { marcacionesExcluidas: newExcluded });
    setOmitLoading(false);
    if (result) {
      reconcileDia(result.dia);
      applyOptimisticTotales(result.totales);
    }
    setPendingOmit(null);
  };

  const handleRestore = async (dia: DiaLiquidacionData, punchIso: string) => {
    const newExcluded = (dia.marcacionesExcluidas ?? []).filter((t) => t !== punchIso);
    const result = await patchDia(dia.id, { marcacionesExcluidas: newExcluded });
    if (result) {
      reconcileDia(result.dia);
      applyOptimisticTotales(result.totales);
    }
  };

  const COL_COUNT = 8;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 32 }} />
            <TableCell>Fecha</TableCell>
            <TableCell>Horas Acumuladas</TableCell>
            <TableCell>Horas Ajust.</TableCell>
            <TableCell>Atraso</TableCell>
            <TableCell>Descuento</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {liquidacion.dias.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COL_COUNT} align="center">
                Sin registros de asistencia esta semana
              </TableCell>
            </TableRow>
          ) : (
            liquidacion.dias.map((dia) => {
              const isExpanded = expanded.has(dia.id);
              const hasDetail = (dia.jornadas?.length ?? 0) > 0 || dia.tieneInconsistencia;
              const displayHours = dia.horasAjustadasSupervisor != null
                ? dia.horasAjustadasSupervisor
                : (dia.horasParejadas ?? dia.horasCalculadas);

              return (
                <>
                  {/* ── Day row ─────────────────────────────────────── */}
                  <TableRow key={dia.id}>
                    <TableCell sx={{ p: 0 }}>
                      {hasDetail ? (
                        <IconButton size="small" onClick={() => toggleExpand(dia.id)}>
                          {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                        </IconButton>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatFecha(dia.fecha)}</TableCell>
                    <TableCell>{Number(displayHours).toFixed(2)} h</TableCell>
                    <TableCell>
                      {dia.horasAjustadasSupervisor != null
                        ? Number(dia.horasAjustadasSupervisor).toFixed(2)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {dia.atrasoDetectado ? (
                        <Chip label="Atraso" size="small" color="error" />
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {descuentoLabel(dia.descuentoTipo, dia.descuentoValor)}
                    </TableCell>
                    <TableCell>
                      {estadoDiaChip(dia.estadoDia)}
                      {dia.tieneInconsistencia && (
                        <Chip label="Marcación suelta" size="small" color="warning" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={isAprobado}
                        onClick={() => setDialogDia(dia)}
                      >
                        Ajustar
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* ── Expanded detail rows ─────────────────────────── */}
                  {isExpanded && (
                    <>
                      {/* Shift sub-rows */}
                      {(dia.jornadas ?? []).map((jornada, idx) => {
                        const isOmitting = pendingOmit?.diaId === dia.id && (
                          pendingOmit.punchIso === jornada.entradaRaw || pendingOmit.punchIso === jornada.salidaRaw
                        );
                        return (
                          <TableRow key={`${dia.id}-j${idx}`} sx={{ backgroundColor: 'action.hover' }}>
                            <TableCell />
                            <TableCell colSpan={3}>
                              <Typography variant="body2" color="text.secondary">
                                Jornada {idx + 1}: {jornada.entrada} – {jornada.salida}{' '}
                                <Typography component="span" variant="body2" color="text.disabled">
                                  ({jornada.horas.toFixed(2)} h)
                                </Typography>
                              </Typography>
                            </TableCell>
                            <TableCell colSpan={3}>
                              {!isAprobado && !isOmitting && (
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  <Button size="small" color="warning" onClick={() => setPendingOmit({ diaId: dia.id, punchIso: jornada.entradaRaw, motivo: OMIT_MOTIVOS[0] })}>
                                    Omitir entrada
                                  </Button>
                                  <Button size="small" color="warning" onClick={() => setPendingOmit({ diaId: dia.id, punchIso: jornada.salidaRaw, motivo: OMIT_MOTIVOS[0] })}>
                                    Omitir salida
                                  </Button>
                                </Box>
                              )}
                              {isOmitting && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Select
                                    size="small"
                                    value={pendingOmit!.motivo}
                                    onChange={(e) => setPendingOmit((p) => p ? { ...p, motivo: e.target.value } : p)}
                                    sx={{ minWidth: 160 }}
                                  >
                                    {OMIT_MOTIVOS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                  </Select>
                                  <Button size="small" variant="contained" color="warning" onClick={handleConfirmOmit} disabled={omitLoading}>
                                    Confirmar
                                  </Button>
                                  <Button size="small" onClick={() => setPendingOmit(null)} disabled={omitLoading}>
                                    Cancelar
                                  </Button>
                                </Box>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Isolated punch sub-row */}
                      {dia.tieneInconsistencia && dia.marcacionSuelta && (
                        <TableRow key={`${dia.id}-suelta`} sx={{ backgroundColor: 'action.hover' }}>
                          <TableCell />
                          <TableCell colSpan={3}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'warning.main' }}>
                              <WarningAmberIcon fontSize="small" />
                              <Typography variant="body2" color="warning.main">
                                Marcación suelta: {dia.marcacionSuelta} — sin pareja
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell colSpan={3}>
                            {!isAprobado && dia.marcacionSueltaRaw && pendingOmit?.punchIso !== dia.marcacionSueltaRaw && (
                              <Button size="small" color="warning" onClick={() => setPendingOmit({ diaId: dia.id, punchIso: dia.marcacionSueltaRaw!, motivo: OMIT_MOTIVOS[0] })}>
                                Omitir
                              </Button>
                            )}
                            {pendingOmit?.diaId === dia.id && pendingOmit.punchIso === dia.marcacionSueltaRaw && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Select
                                  size="small"
                                  value={pendingOmit.motivo}
                                  onChange={(e) => setPendingOmit((p) => p ? { ...p, motivo: e.target.value } : p)}
                                  sx={{ minWidth: 160 }}
                                >
                                  {OMIT_MOTIVOS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                                </Select>
                                <Button size="small" variant="contained" color="warning" onClick={handleConfirmOmit} disabled={omitLoading}>
                                  Confirmar
                                </Button>
                                <Button size="small" onClick={() => setPendingOmit(null)} disabled={omitLoading}>
                                  Cancelar
                                </Button>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Excluded punch display rows */}
                      {(dia.excludedPunchDisplay ?? []).map((ep) => (
                        <TableRow key={`${dia.id}-excl-${ep.iso}`} sx={{ backgroundColor: 'action.hover' }}>
                          <TableCell />
                          <TableCell colSpan={3}>
                            <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
                              {ep.hhmm} — omitida
                            </Typography>
                          </TableCell>
                          <TableCell colSpan={3}>
                            {!isAprobado && (
                              <Button size="small" onClick={() => handleRestore(dia, ep.iso)}>
                                Restaurar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </>
              );
            })
          )}
        </TableBody>
      </Table>

      {dialogDia && (
        <DiaAjusteDialog
          dia={dialogDia}
          open
          onClose={() => setDialogDia(null)}
        />
      )}
    </Box>
  );
}
