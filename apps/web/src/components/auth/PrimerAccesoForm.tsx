'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';

const schema = z.object({
  email: z.string().email('Correo inválido').max(254),
});

type FormValues = z.infer<typeof schema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function PrimerAccesoForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      await axios.post(`${API_URL}/auth/primer-acceso`, data);
      setSent(true);
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setServerError('No encontramos una cuenta con ese correo.');
      } else {
        setServerError('Error inesperado. Intente de nuevo.');
      }
    }
  };

  if (sent) {
    return (
      <div className="rounded-md bg-green-50 px-4 py-4 text-sm text-green-800">
        <p className="font-medium">Revisa tu correo</p>
        <p className="mt-1 text-green-700">
          Si existe una cuenta, recibirás un enlace para establecer tu
          contraseña inicial.
        </p>
      </div>
    );
  }

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
          placeholder="tu@correo.com"
          {...register('email')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.email && (
          <p className="text-xs text-red-600">{errors.email.message}</p>
        )}
      </div>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Enviando...' : 'Activar cuenta'}
      </button>
    </form>
  );
}
