import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted } from '@/lib/auth-server';
import { PlanillaView } from '@/components/liquidaciones/PlanillaView';

export default async function LiquidacionesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login?reason=expired');

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token!);
  } catch {
    redirect('/login?reason=expired');
  }

  if (isBlacklisted(payload!.jti)) redirect('/login?reason=expired');

  const isAdmin = payload!.roles.includes('ADMINISTRADOR');

  return <PlanillaView isAdmin={isAdmin} />;
}
