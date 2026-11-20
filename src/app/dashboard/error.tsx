'use client';

import { ErrorView } from 'src/sections/error/view';

// ----------------------------------------------------------------------

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: Props) {
  return <ErrorView onRetry={reset} digest={error.digest} />;
}
