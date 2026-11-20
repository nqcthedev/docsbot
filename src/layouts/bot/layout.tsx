import type { IBotItem, IBotTabCounts } from 'src/types/bot';

import { ExternalLink } from 'lucide-react';

import { paths } from 'src/routes/paths';

import { botNavTabs } from 'src/layouts/config-nav-bot';

import { Badge } from 'src/components/ui';
import { NavTabs } from 'src/components/nav-tabs';

// ----------------------------------------------------------------------

type Props = {
  bot: Pick<IBotItem, 'id' | 'name' | 'brandColor'>;
  counts: IBotTabCounts;
  children: React.ReactNode;
};

/** Every page of one bot: its name and status, the tab bar, then the page. */
export function BotLayout({ bot, counts, children }: Props) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="size-3 rounded-full ring-4 ring-zinc-100"
            style={{ backgroundColor: bot.brandColor }}
          />
          <h1 className="text-2xl font-semibold tracking-tight">{bot.name}</h1>
          {counts.readySources > 0 ? (
            <Badge tone="green">Live</Badge>
          ) : (
            <Badge tone="amber">Needs content</Badge>
          )}
        </div>
        <a
          href={paths.embed.standalone(bot.id)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          Open chat page <ExternalLink className="size-3.5" />
        </a>
      </div>
      <div className="mt-5">
        <NavTabs items={botNavTabs(bot.id, counts)} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
