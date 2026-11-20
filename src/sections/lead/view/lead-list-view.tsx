import type { ILeadItem } from 'src/types/lead';

import { Inbox, Download } from 'lucide-react';

import { paths } from 'src/routes/paths';

import { Card, CardHeader, EmptyState, buttonVariants } from 'src/components/ui';

import { LeadTableRow } from '../lead-table-row';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  leads: ILeadItem[];
};

export function LeadListView({ botId, leads }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Leads"
        description="Visitors who asked for a human or whose question the bot couldn't answer."
        action={
          leads.length ? (
            <a
              href={paths.dashboard.bot.leadsExport(botId)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Download /> Export CSV
            </a>
          ) : null
        }
      />
      {leads.length === 0 ? (
        <EmptyState icon={<Inbox />} title="No leads yet">
          When the bot can&apos;t answer or a visitor asks for a person, the widget offers to
          collect their email.
        </EmptyState>
      ) : (
        <table className="w-full text-sm" data-testid="leads-table">
          <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-5 py-2.5 font-medium">Email</th>
              <th className="px-3 py-2.5 font-medium">Question</th>
              <th className="px-3 py-2.5 font-medium">Conversation</th>
              <th className="px-5 py-2.5 text-right font-medium">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {leads.map((lead) => (
              <LeadTableRow key={lead.id} botId={botId} lead={lead} />
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
