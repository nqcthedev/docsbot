import type { IConversationDetails } from 'src/types/conversation';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { paths } from 'src/routes/paths';

import { Card } from 'src/components/ui';

import { ConversationMessage } from '../conversation-message';
import { ConversationDetailsCard } from '../conversation-details-card';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  details: IConversationDetails;
};

export function ConversationDetailsView({ botId, details }: Props) {
  return (
    <div className="space-y-4">
      <Link
        href={paths.dashboard.bot.conversations(botId)}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" /> All conversations
      </Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-5 lg:col-span-2">
          {details.messages.map((message) => (
            <ConversationMessage key={message.id} message={message} />
          ))}
        </Card>
        <ConversationDetailsCard conversation={details.conversation} leads={details.leads} />
      </div>
    </div>
  );
}
