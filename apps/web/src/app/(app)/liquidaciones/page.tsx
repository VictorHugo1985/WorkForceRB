import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted } from '@/lib/auth-server';
import { LiquidacionesListClient } from '@/components/liquidaciones/LiquidacionesListClient';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function fetchJson<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export default async function LiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ semana_id?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  try {
    const payload = await verifyToken(token);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
  } catch {
    redirect('/login?reason=expired');
  }

  const { semana_id } = await searchParams;
  const resumenPath = `/liquidaciones/resumen${semana_id ? `?semana_id=${semana_id}` : ''}`;

  const [resumenData, semanasData] = await Promise.all([
    fetchJson<{ semana: { id: string; fecha_inicio: string; fecha_fin: string; estado: string } | null; liquidaciones: unknown[] }>(resumenPath, token),
    fetchJson<{ id: string; fecha_inicio: string; fecha_fin: string; estado: string }[]>('/semanas-laborales', token),
  ]);

  const semanas = Array.isArray(semanasData) ? semanasData : [];
  const semanaActiva = resumenData?.semana ?? null;
  const liquidaciones = (resumenData?.liquidaciones ?? []) as {
    colaboradorId: string;
    colaboradorNombre: string;
    colaboradorApellido: string;
    area: string | null;
    liquidacionId: string | null;
    estado: string | null;
    totalPago: number | null;
  }[];

  return (
    <LiquidacionesListClient
      semanaActiva={semanaActiva}
      semanas={semanas}
      liquidaciones={liquidaciones}
    />
  );
}
