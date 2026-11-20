'use client';

import Link from 'next/link';

import { useActiveLink } from 'src/routes/hooks';

import { cn } from 'src/utils/cn';

// ----------------------------------------------------------------------

export type NavTabsItem = {
  href: string;
  label: string;
  /** Shown as a pill next to the label when greater than zero. */
  count?: number;
  /** Only active on exactly this path, not on its sub-pages. */
  exact?: boolean;
};

// ----------------------------------------------------------------------

type Props = {
  items: NavTabsItem[];
};

/** Horizontal tab bar of links, one tab per page. */
export function NavTabs({ items }: Props) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-zinc-200">
      {items.map((item) => (
        <NavTab key={item.href} item={item} />
      ))}
    </nav>
  );
}

// ----------------------------------------------------------------------

type NavTabProps = {
  item: NavTabsItem;
};

function NavTab({ item }: NavTabProps) {
  const isActive = useActiveLink(item.href, item.exact);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
        isActive
          ? 'border-brand-600 font-medium text-zinc-900'
          : 'border-transparent text-zinc-500 hover:text-zinc-900'
      )}
    >
      {item.label}
      {item.count ? (
        <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-600">
          {item.count}
        </span>
      ) : null}
    </Link>
  );
}
