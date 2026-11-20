import { listBotNavItems } from 'src/server/data';
import { DashboardLayout } from 'src/layouts/dashboard';

import { requireUser } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const dynamic = 'force-dynamic';

type Props = {
  children: React.ReactNode;
};

export default async function Layout({ children }: Props) {
  const user = await requireUser();
  const bots = await listBotNavItems(user.workspaceId);

  return (
    <DashboardLayout user={user} bots={bots}>
      {children}
    </DashboardLayout>
  );
}
