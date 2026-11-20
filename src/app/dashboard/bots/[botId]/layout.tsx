import { ExternalLink } from 'lucide-react';
import { eq, and, count } from 'drizzle-orm';

import { getDb } from 'src/server/db';
import { requireBot } from 'src/server/data';
import { leads, sources } from 'src/server/db/schema';

import { Badge } from 'src/components/ui';
import { TabNav } from 'src/components/nav';

export default async function BotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const db = await getDb();
  const [[srcCount], [leadCount], [readyCount]] = await Promise.all([
    db.select({ n: count() }).from(sources).where(eq(sources.botId, bot.id)),
    db.select({ n: count() }).from(leads).where(eq(leads.botId, bot.id)),
    db
      .select({ n: count() })
      .from(sources)
      .where(and(eq(sources.botId, bot.id), eq(sources.status, 'ready'))),
  ]);
  const base = `/dashboard/bots/${bot.id}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="size-3 rounded-full ring-4 ring-zinc-100"
            style={{ backgroundColor: bot.brandColor }}
          />
          <h1 className="text-2xl font-semibold tracking-tight">{bot.name}</h1>
          {Number(readyCount?.n ?? 0) > 0 ? (
            <Badge tone="green">Live</Badge>
          ) : (
            <Badge tone="amber">Needs content</Badge>
          )}
        </div>
        <a
          href={`/embed/${bot.id}?mode=standalone`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
        >
          Open chat page <ExternalLink className="size-3.5" />
        </a>
      </div>
      <div className="mt-5">
        <TabNav
          base={base}
          tabs={[
            { href: '', label: 'Overview' },
            { href: '/sources', label: 'Sources', count: Number(srcCount?.n ?? 0) },
            { href: '/playground', label: 'Playground' },
            { href: '/conversations', label: 'Conversations' },
            { href: '/leads', label: 'Leads', count: Number(leadCount?.n ?? 0) },
            { href: '/settings', label: 'Settings' },
            { href: '/install', label: 'Install' },
          ]}
        />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
