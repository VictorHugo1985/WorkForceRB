import Link from 'next/link';
import { PrimerAccesoForm } from '@/components/auth/PrimerAccesoForm';

export const metadata = { title: 'Primer acceso — Workforce' };

export default function PrimerAccesoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">
          Primer acceso
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          Ingresa tu correo para activar tu cuenta
        </p>
        <PrimerAccesoForm />
        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Ya tienes acceso?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
