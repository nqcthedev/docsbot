import type { IConversationItem } from 'src/types/conversation';

import { MessagesSquare } from 'lucide-react';

import { Card, EmptyState } from 'src/components/ui';

import { ConversationTableRow } from '../conversation-table-row';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  conversations: IConversationItem[];
};

export function ConversationListView({ botId, conversations }: Props) {
  if (!conversations.length) {
    return (
      <Card>
        <EmptyState icon={<MessagesSquare />} title="No conversations yet">
          Conversations from the widget and the playground appear here.
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs text-zinc-500">
          <tr>
            <th className="px-5 py-2.5 font-medium">First question</th>
            <th className="px-3 py-2.5 font-medium">Channel</th>
            <th className="px-3 py-2.5 text-right font-medium">Messages</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-5 py-2.5 text-right font-medium">Last activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {conversations.map((conversation) => (
            <ConversationTableRow key={conversation.id} botId={botId} conversation={conversation} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}
