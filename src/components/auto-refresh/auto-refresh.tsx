'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ----------------------------------------------------------------------

type Props = {
  intervalMs: number;
};

/** Re-renders the current server component tree on an interval, e.g. while sources ingest. */
export function AutoRefresh({ intervalMs }: Props) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
