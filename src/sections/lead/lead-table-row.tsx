import type { ILeadItem } from 'src/types/lead';

import Link from 'next/link';

import { paths } from 'src/routes/paths';

import { formatDateTime } from 'src/utils/format-time';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  lead: ILeadItem;
};

export function LeadTableRow({ botId, lead }: Props) {
  return (
    <tr>
      <td className="px-5 py-3 font-medium text-zinc-800">
        {lead.email}
        {lead.name ? (
          <span className="block text-xs font-normal text-zinc-500">{lead.name}</span>
        ) : null}
      </td>
      <td className="max-w-md px-3 py-3 text-zinc-600">{lead.question}</td>
      <td className="px-3 py-3">
        {lead.conversationId ? (
          <Link
            href={paths.dashboard.bot.conversation(botId, lead.conversationId)}
            className="text-brand-600 hover:underline"
          >
            View
          </Link>
        ) : (
          '—'
        )}
      </td>
      <td className="px-5 py-3 text-right text-zinc-500">{formatDateTime(lead.createdAt)}</td>
    </tr>
  );
}
