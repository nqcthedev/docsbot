import Link from 'next/link';
import { SearchX } from 'lucide-react';

import { Card, EmptyState, buttonVariants } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  /** Where the "back" link leads, e.g. the dashboard or the landing page. */
  backHref: string;
  backLabel: string;
};

export function NotFoundView({ backHref, backLabel }: Props) {
  return (
    <Card>
      <EmptyState icon={<SearchX />} title="Page not found">
        <p>This page does not exist, or you don&apos;t have access to it.</p>
        <Link
          href={backHref}
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-4' })}
        >
          {backLabel}
        </Link>
      </EmptyState>
    </Card>
  );
}
