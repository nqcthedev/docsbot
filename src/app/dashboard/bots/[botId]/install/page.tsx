import { env } from 'src/server/env';
import { CONFIG } from 'src/config-global';

import { InstallView } from 'src/sections/install/view';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Install · ${CONFIG.appName}` };

type Props = {
  params: Promise<{ botId: string }>;
};

export default async function Page({ params }: Props) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);

  return (
    <InstallView
      appUrl={env().APP_URL.replace(/\/$/, '')}
      botId={bot.id}
      allowedDomains={bot.allowedDomains}
    />
  );
}
