'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const MESSAGES: Record<string, string> = {
  expired: 'Tu sesión expiró. Por favor inicia sesión nuevamente.',
  inactive: 'Tu cuenta está inactiva. Contacta al administrador.',
};

export function SessionExpiredBanner() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const [visible, setVisible] = useState(!!reason);

  useEffect(() => {
    if (!reason) return;
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [reason]);

  const message = reason ? MESSAGES[reason] : null;
  if (!visible || !message) return null;

  return (
    <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      {message}
    </div>
  );
}
