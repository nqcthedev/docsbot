'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-renders the current server component tree on an interval (used while sources are ingesting). */
export function AutoRefresh({ intervalMs = 2000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
