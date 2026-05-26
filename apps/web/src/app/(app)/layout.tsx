import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, isBlacklisted } from '@/lib/auth-server';
import { AppLayoutClient } from './AppLayoutClient';

async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) return null;
  try {
    const payload = await verifyToken(token);
    if (isBlacklisted(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect('/login?reason=expired');

  return (
    <AppLayoutClient
      nombre={user.nombre}
      roles={user.roles}
      exp={user.exp}
    >
      {children}
    </AppLayoutClient>
  );
}
