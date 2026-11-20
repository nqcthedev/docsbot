import type { IBotTabCounts } from 'src/types/bot';
import type { NavTabsItem } from 'src/components/nav-tabs';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------

/** Tabs of a bot's pages, with live counters where they help. */
export function botNavTabs(botId: string, counts: IBotTabCounts): NavTabsItem[] {
  const bot = paths.dashboard.bot;
  return [
    { href: bot.root(botId), label: 'Overview', exact: true },
    { href: bot.sources(botId), label: 'Sources', count: counts.sources },
    { href: bot.playground(botId), label: 'Playground' },
    { href: bot.conversations(botId), label: 'Conversations' },
    { href: bot.leads(botId), label: 'Leads', count: counts.leads },
    { href: bot.settings(botId), label: 'Settings' },
    { href: bot.install(botId), label: 'Install' },
  ];
}
