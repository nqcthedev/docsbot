import type { IBotNavItem } from 'src/types/bot';
import type { IAccountSummary } from 'src/types/user';

import { DashboardNavVertical } from './nav-vertical';
import { DashboardHeaderMobile } from './header-mobile';

// ----------------------------------------------------------------------

type Props = {
  user: IAccountSummary;
  bots: IBotNavItem[];
  children: React.ReactNode;
};

export function DashboardLayout({ user, bots, children }: Props) {
  return (
    <div className="flex min-h-screen">
      <DashboardNavVertical user={user} bots={bots} />
      <div className="min-w-0 flex-1">
        <DashboardHeaderMobile />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
