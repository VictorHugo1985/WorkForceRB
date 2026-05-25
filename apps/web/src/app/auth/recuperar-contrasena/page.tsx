import Link from 'next/link';
import { RecuperarContrasenaForm } from '@/components/auth/RecuperarContrasenaForm';

export const metadata = { title: 'Recuperar contraseña — Workforce' };

export default function RecuperarContrasenaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">
          Recuperar contraseña
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Ingresa tu correo y te enviaremos las instrucciones
        </p>
        <RecuperarContrasenaForm />
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="text-blue-600 hover:underline">
            ← Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
