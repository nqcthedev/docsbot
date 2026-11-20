import { CONFIG } from 'src/config-global';
import { registry } from 'src/server/ai/registry';
import { botAnalytics, staleChunkCount } from 'src/server/data';

import { BotOverviewView } from 'src/sections/bot/view';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Overview · ${CONFIG.appName}` };

type Props = {
  params: Promise<{ botId: string }>;
};

export default async function Page({ params }: Props) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const [analytics, staleChunks] = await Promise.all([
    botAnalytics(bot.id),
    staleChunkCount(bot.id),
  ]);

  return (
    <BotOverviewView
      botId={bot.id}
      analytics={analytics}
      staleChunks={staleChunks}
      embeddingModel={registry().embeddings?.model}
    />
  );
}
