import { env } from 'src/server/env';
import { CONFIG } from 'src/config-global';
import { listSources } from 'src/server/data';

import { SourceListView } from 'src/sections/source/view';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Sources · ${CONFIG.appName}` };

type Props = {
  params: Promise<{ botId: string }>;
};

export default async function Page({ params }: Props) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const sources = await listSources(bot.id);
  const { CRAWLER_MAX_PAGES, MAX_UPLOAD_MB } = env();

  return (
    <SourceListView
      botId={bot.id}
      sources={sources}
      maxPagesCap={CRAWLER_MAX_PAGES}
      maxUploadMb={MAX_UPLOAD_MB}
    />
  );
}
