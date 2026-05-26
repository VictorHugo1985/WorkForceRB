import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { verifyToken, isBlacklisted } from '@/lib/auth-server';

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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="font-semibold text-gray-900">Workforce</span>
          <nav className="flex items-center gap-4">
            {user.roles.includes('ADMINISTRADOR') && (
              <Link href="/colaboradores/nuevo" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                Registrar colaborador
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user.nombre}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
