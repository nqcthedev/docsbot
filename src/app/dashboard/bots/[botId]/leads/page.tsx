import { CONFIG } from 'src/config-global';
import { listRecentLeads } from 'src/server/data';

import { LeadListView } from 'src/sections/lead/view';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Leads · ${CONFIG.appName}` };

type Props = {
  params: Promise<{ botId: string }>;
};

export default async function Page({ params }: Props) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const leads = await listRecentLeads(bot.id);

  return <LeadListView botId={bot.id} leads={leads} />;
}
