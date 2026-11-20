'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';

import { Card, Button, EmptyState } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  /** Re-renders the failed segment (Next.js error boundary `reset`). */
  onRetry: () => void;
  /** Server-side log correlation id, safe to show; the error message itself is not. */
  digest?: string;
};

export function ErrorView({ onRetry, digest }: Props) {
  return (
    <Card role="alert">
      <EmptyState icon={<TriangleAlert />} title="Something went wrong">
        <p>This page could not be loaded. Try again in a moment.</p>
        {digest ? <p className="mt-1 font-mono text-xs text-zinc-400">Error ID: {digest}</p> : null}
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw /> Try again
        </Button>
      </EmptyState>
    </Card>
  );
}
