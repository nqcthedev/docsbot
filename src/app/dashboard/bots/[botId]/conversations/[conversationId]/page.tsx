import { notFound } from 'next/navigation';

import { CONFIG } from 'src/config-global';
import { entityIdSchema } from 'src/server/validation';
import { getConversationDetails } from 'src/server/data';

import { ConversationDetailsView } from 'src/sections/conversation/view';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Conversation · ${CONFIG.appName}` };

type Props = {
  params: Promise<{ botId: string; conversationId: string }>;
};

export default async function Page({ params }: Props) {
  const { botId, conversationId } = await params;
  const { bot } = await requireBot(botId);
  if (!entityIdSchema.safeParse(conversationId).success) notFound();

  const details = await getConversationDetails(bot.id, conversationId);
  if (!details) notFound();

  return <ConversationDetailsView botId={bot.id} details={details} />;
}
