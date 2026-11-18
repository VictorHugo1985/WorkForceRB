import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken, isBlacklisted, pool } from '@/lib/auth-server';
import { getLiquidacionDetail } from '@/lib/liquidacion-db';
import { LiquidacionDetailClient } from '@/components/liquidaciones/LiquidacionDetailClient';

export default async function LiquidacionDetailPage({
  params,
}: {
  params: Promise<{ semanaId: string; colaboradorId: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  try {
    const payload = await verifyToken(token!);
    if (isBlacklisted(payload.jti)) redirect('/login?reason=expired');
  } catch {
    redirect('/login?reason=expired');
  }

  const { semanaId, colaboradorId } = await params;

  let client;
  try {
    client = await pool.connect();
  } catch {
    notFound();
  }

  try {
    const result = await getLiquidacionDetail(client!, colaboradorId, semanaId);
    if (!result) notFound();
    return <LiquidacionDetailClient initialData={result.data} semanaFechas={result.semanaFechas} />;
  } catch (err) {
    const e = err as { digest?: string };
    if (e.digest?.startsWith('NEXT_REDIRECT') || e.digest?.startsWith('NEXT_NOT_FOUND')) throw err;
    notFound();
  } finally {
    client?.release();
  }
}
