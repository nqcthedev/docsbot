import type { IConversationItem } from 'src/types/conversation';

import Link from 'next/link';

import { paths } from 'src/routes/paths';

import { formatDateTime } from 'src/utils/format-time';

import { Badge } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  conversation: IConversationItem;
};

export function ConversationTableRow({ botId, conversation }: Props) {
  const { id, channel, pageOrigin, messageCount, firstQuestion, unansweredCount, hasLead } =
    conversation;

  return (
    <tr className="hover:bg-zinc-50">
      <td className="max-w-md px-5 py-3">
        <Link
          href={paths.dashboard.bot.conversation(botId, id)}
          className="line-clamp-1 font-medium text-zinc-800 hover:text-brand-700"
        >
          {firstQuestion ?? '(no messages)'}
        </Link>
        {pageOrigin ? <p className="text-xs text-zinc-400">{pageOrigin}</p> : null}
      </td>
      <td className="px-3 py-3">
        <Badge tone={channel === 'widget' ? 'blue' : 'neutral'}>{channel}</Badge>
      </td>
      <td className="px-3 py-3 text-right tabular-nums">{messageCount}</td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          {unansweredCount > 0 ? (
            <Badge tone="amber">{unansweredCount} unanswered</Badge>
          ) : (
            <Badge tone="green">answered</Badge>
          )}
          {hasLead ? <Badge tone="blue">lead</Badge> : null}
        </div>
      </td>
      <td className="px-5 py-3 text-right text-zinc-500">
        {formatDateTime(conversation.lastMessageAt)}
      </td>
    </tr>
  );
}
