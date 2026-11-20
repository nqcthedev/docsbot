import { Loader2 } from 'lucide-react';

// ----------------------------------------------------------------------

type Props = {
  label?: string;
};

/** Placeholder while a server-rendered page streams in. Announced politely to screen readers. */
export function LoadingScreen({ label = 'Loading…' }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-64 items-center justify-center gap-2 text-sm text-zinc-500"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}
