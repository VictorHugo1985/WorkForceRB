'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const schema = z.object({
  email: z.string().email('Correo inválido').max(254),
  password: z.string().min(1, 'La contraseña es requerida').max(128),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') ?? '/dashboard';

  const [serverError, setServerError] = useState<string | null>(null);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    setLockMessage(null);

    try {
      const res = await axios.post<{
        nombre: string;
        roles: string[];
        debeChangiarPassword: boolean;
      }>('/api/auth/login', data);

      if (res.data.debeChangiarPassword) {
        router.push('/auth/cambiar-contrasena');
      } else {
        router.push(returnUrl);
      }
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429) {
          const retry = err.response?.data?.retryAfterSeconds ?? 900;
          const min = Math.ceil(retry / 60);
          setLockMessage(
            `Cuenta bloqueada temporalmente. Intente en ${min} minutos.`,
          );
        } else if (status === 401) {
          setServerError('Credenciales inválidas');
        } else {
          setServerError('Error inesperado. Intente de nuevo.');
        }
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Correo electrónico
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.email && (
          <p className="text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-gray-700"
        >
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.password && (
          <p className="text-xs text-red-600">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      )}

      {lockMessage && (
        <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          {lockMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Ingresando...' : 'Ingresar'}
      </button>

      <div className="flex flex-col items-center gap-2 pt-1">
        <Link
          href="/auth/primer-acceso"
          className="text-sm text-blue-600 hover:underline"
        >
          Primer acceso
        </Link>
        <Link
          href="/auth/recuperar-contrasena"
          className="text-sm text-gray-500 hover:underline"
        >
          Olvidé mi contraseña
        </Link>
      </div>
    </form>
  );
}
