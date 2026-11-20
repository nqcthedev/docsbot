import Link from 'next/link';

import { paths } from 'src/routes/paths';

import { mainNavItems } from 'src/layouts/config-nav-main';

import { Logo } from 'src/components/logo';
import { buttonVariants } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  isSignedIn: boolean;
};

export function MainHeader({ isSignedIn }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex">
          {mainNavItems.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-zinc-900">
              {item.title}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Link href={paths.dashboard.root} className={buttonVariants({ variant: 'default' })}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href={paths.auth.login} className={buttonVariants({ variant: 'ghost' })}>
                Log in
              </Link>
              <Link href={paths.auth.signup} className={buttonVariants({ variant: 'brand' })}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
