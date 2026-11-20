import Link from 'next/link';

import { paths } from 'src/routes/paths';

import { Logo } from 'src/components/logo';

// ----------------------------------------------------------------------

/** Replaces the sidebar below the md breakpoint. */
export function DashboardHeaderMobile() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 md:hidden">
      <Logo href={paths.dashboard.root} />
      <Link href={paths.dashboard.root} className="text-sm text-zinc-600">
        Bots
      </Link>
    </header>
  );
}
