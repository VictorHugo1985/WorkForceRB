import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted } from '@/lib/auth-server';
import { SemanasListClient } from '@/components/semanas/SemanasListClient';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export default async function SemanasLaboralesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  let payload: { roles: string[] };
  try {
    payload = await verifyToken(token);
    if (isBlacklisted((payload as { jti?: string }).jti ?? '')) redirect('/login?reason=expired');
  } catch {
    redirect('/login?reason=expired');
  }

  let semanas: {
    id: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
    creado_en: string;
  }[] = [];

  try {
    const res = await fetch(`${API_URL}/semanas-laborales`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) semanas = await res.json();
  } catch { /* show empty state */ }

  const isAdmin = payload.roles.includes('ADMINISTRADOR');

  return <SemanasListClient semanas={semanas} isAdmin={isAdmin} />;
}
