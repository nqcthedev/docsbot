import type { IConversationDetails } from 'src/types/conversation';

import { formatDateTime } from 'src/utils/format-time';

import { Card, Badge } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  conversation: IConversationDetails['conversation'];
  leads: IConversationDetails['leads'];
};

export function ConversationDetailsCard({ conversation, leads }: Props) {
  return (
    <Card className="h-fit space-y-3 p-5 text-sm">
      <h3 className="font-semibold">Details</h3>
      <dl className="space-y-2 text-zinc-600">
        <div className="flex justify-between">
          <dt>Channel</dt>
          <dd>
            <Badge>{conversation.channel}</Badge>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Page</dt>
          <dd className="truncate">{conversation.pageOrigin ?? '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Started</dt>
          <dd>{formatDateTime(conversation.createdAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Messages</dt>
          <dd>{conversation.messageCount}</dd>
        </div>
      </dl>
      {leads.map((lead) => (
        <div
          key={lead.id}
          className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-brand-800"
        >
          <p className="font-medium">Lead captured</p>
          <p className="mt-1">{lead.email}</p>
          <p className="mt-1 text-xs">“{lead.question}”</p>
        </div>
      ))}
    </Card>
  );
}
