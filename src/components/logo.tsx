import Link from 'next/link';

import { cn } from 'src/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-grid size-7 place-items-center rounded-lg bg-brand-600 text-white shadow-sm',
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden
      >
        <path d="M7 8h10M7 12h6" />
        <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </svg>
    </span>
  );
}

export function Logo({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-900',
        className
      )}
    >
      <LogoMark />
      DocsBot
    </Link>
  );
}
