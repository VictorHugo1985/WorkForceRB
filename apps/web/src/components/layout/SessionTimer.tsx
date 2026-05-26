'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface SessionTimerProps {
  exp: number;
}

export function SessionTimer({ exp }: SessionTimerProps) {
  const router = useRouter();

  useEffect(() => {
    const delay = exp * 1000 - Date.now();
    if (delay <= 0) {
      router.replace('/login?expired=1');
      return;
    }
    const t = setTimeout(() => router.replace('/login?expired=1'), delay);
    return () => clearTimeout(t);
  }, [exp, router]);

  return null;
}
