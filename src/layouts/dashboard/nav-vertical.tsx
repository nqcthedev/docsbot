import type { IBotNavItem } from 'src/types/bot';
import type { IAccountSummary } from 'src/types/user';

import { LogOut } from 'lucide-react';

import { paths } from 'src/routes/paths';

import { logout } from 'src/actions/auth';

import { Logo } from 'src/components/logo';
import { NavSectionItem } from 'src/components/nav-section';

// ----------------------------------------------------------------------

type Props = {
  user: IAccountSummary;
  bots: IBotNavItem[];
};

/** Desktop sidebar: workspace bots, then the signed-in account with a log-out button. */
export function DashboardNavVertical({ user, bots }: Props) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 md:flex">
      <Logo href={paths.dashboard.root} className="px-2" />
      <div className="mt-6 px-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        {user.workspaceName}
      </div>
      <nav className="mt-2 space-y-0.5">
        <NavSectionItem href={paths.dashboard.root} exact>
          All bots
        </NavSectionItem>
        {bots.map((bot) => (
          <NavSectionItem key={bot.id} href={paths.dashboard.bot.root(bot.id)}>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: bot.brandColor }}
            />
            <span className="truncate">{bot.name}</span>
          </NavSectionItem>
        ))}
      </nav>
      <div className="mt-auto border-t border-zinc-100 pt-3">
        <div className="px-2">
          <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
        </div>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
