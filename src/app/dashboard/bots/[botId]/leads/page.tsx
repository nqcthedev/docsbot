import Link from 'next/link';
import { eq, desc } from 'drizzle-orm';
import { Inbox, Download } from 'lucide-react';

import { getDb } from 'src/server/db';
import { requireBot } from 'src/server/data';
import { leads } from 'src/server/db/schema';
import { formatDateTime } from 'src/lib/utils';

import { Card, CardHeader, EmptyState, buttonVariants } from 'src/components/ui';

export const metadata = { title: 'Leads' };

export default async function LeadsPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const db = await getDb();
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.botId, bot.id))
    .orderBy(desc(leads.createdAt))
    .limit(500);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Leads"
        description="Visitors who asked for a human or whose question the bot couldn't answer."
        action={
          rows.length ? (
            <a
              href={`/dashboard/bots/${bot.id}/leads/export`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Download /> Export CSV
            </a>
          ) : null
        }
      />
      {rows.length === 0 ? (
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
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3 font-medium text-zinc-800">
                  {l.email}
                  {l.name ? (
                    <span className="block text-xs font-normal text-zinc-500">{l.name}</span>
                  ) : null}
                </td>
                <td className="max-w-md px-3 py-3 text-zinc-600">{l.question}</td>
                <td className="px-3 py-3">
                  {l.conversationId ? (
                    <Link
                      href={`/dashboard/bots/${bot.id}/conversations/${l.conversationId}`}
                      className="text-brand-600 hover:underline"
                    >
                      View
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-5 py-3 text-right text-zinc-500">
                  {formatDateTime(l.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
