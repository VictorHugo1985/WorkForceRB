'use client';

import axios from 'axios';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout', {});
    } finally {
      router.push('/login');
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
    >
      Cerrar sesión
    </button>
  );
}
