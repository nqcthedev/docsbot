import { BotLayout } from 'src/layouts/bot';
import { getBotTabCounts } from 'src/server/data';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
  params: Promise<{ botId: string }>;
};

export default async function Layout({ children, params }: Props) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const counts = await getBotTabCounts(bot.id);

  return (
    <BotLayout bot={bot} counts={counts}>
      {children}
    </BotLayout>
  );
}
