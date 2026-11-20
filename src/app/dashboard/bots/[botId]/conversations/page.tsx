import { CONFIG } from 'src/config-global';
import { listConversations } from 'src/server/data';

import { ConversationListView } from 'src/sections/conversation/view';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Conversations · ${CONFIG.appName}` };

type Props = {
  params: Promise<{ botId: string }>;
};

export default async function Page({ params }: Props) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const conversations = await listConversations(bot.id);

  return <ConversationListView botId={bot.id} conversations={conversations} />;
}
