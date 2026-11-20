import { CONFIG } from 'src/config-global';
import { listBotsWithStats } from 'src/server/data';

import { OverviewBotsView } from 'src/sections/overview/view';

import { requireUser } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Bots · ${CONFIG.appName}` };

export default async function Page() {
  const user = await requireUser();
  const bots = await listBotsWithStats(user.workspaceId);
  return <OverviewBotsView bots={bots} />;
}
