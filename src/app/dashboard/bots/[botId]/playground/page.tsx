import { CONFIG } from 'src/config-global';
import { countReadySources } from 'src/server/data';

import { PlaygroundView } from 'src/sections/playground/view';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Playground · ${CONFIG.appName}` };

type Props = {
  params: Promise<{ botId: string }>;
};

export default async function Page({ params }: Props) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const readySources = await countReadySources(bot.id);

  return <PlaygroundView bot={bot} hasReadySources={readySources > 0} />;
}
