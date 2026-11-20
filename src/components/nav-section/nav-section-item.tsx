'use client';

import Link from 'next/link';

import { useActiveLink } from 'src/routes/hooks';

import { cn } from 'src/utils/cn';

// ----------------------------------------------------------------------

type Props = {
  href: string;
  /** Only active on exactly this path, not on its sub-pages. */
  exact?: boolean;
  children: React.ReactNode;
};

/** A link of the vertical (sidebar) navigation, highlighted while its page is open. */
export function NavSectionItem({ href, exact, children }: Props) {
  const isActive = useActiveLink(href, exact);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        isActive
          ? 'bg-zinc-100 font-medium text-zinc-900'
          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
      )}
    >
      {children}
    </Link>
  );
}
