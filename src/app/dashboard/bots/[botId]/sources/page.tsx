import { Type, Globe, Trash2, Loader2, FileText, RefreshCw } from 'lucide-react';

import { env } from 'src/server/env';
import { timeAgo, formatNumber } from 'src/lib/utils';
import { requireBot, listSources } from 'src/server/data';
import { deleteSource, resyncSource } from 'src/app/dashboard/actions';

import { AutoRefresh } from 'src/components/auto-refresh';
import { Card, Badge, CardHeader, EmptyState } from 'src/components/ui';

import { AddSource } from './add-source';

export const metadata = { title: 'Sources' };

const icons = { website: Globe, pdf: FileText, text: Type };

export default async function SourcesPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const list = await listSources(bot.id);
  const busy = list.some((s) => s.status === 'pending' || s.status === 'processing');
  const e = env();

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <AddSource botId={bot.id} maxPagesCap={e.CRAWLER_MAX_PAGES} maxUploadMb={e.MAX_UPLOAD_MB} />
      </div>
      <Card className="lg:col-span-3">
        <CardHeader
          title="Knowledge sources"
          description="Everything the bot is allowed to answer from."
          action={
            busy ? (
              <span className="flex items-center gap-1.5 text-xs text-brand-600">
                <Loader2 className="size-3.5 animate-spin" /> Processing
              </span>
            ) : null
          }
        />
        {busy ? <AutoRefresh intervalMs={1500} /> : null}
        {list.length === 0 ? (
          <EmptyState icon={<Globe />} title="No sources yet">
            Add your website, a PDF or some FAQ text. The bot only answers from what you add here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-100" data-testid="sources-list">
            {list.map((s) => {
              const Icon = icons[s.type];
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 px-5 py-4"
                  data-testid="source-row"
                  data-status={s.status}
                >
                  <span className="mt-0.5 rounded-lg bg-zinc-100 p-2 text-zinc-600">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-zinc-900">{s.name}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {s.type === 'website'
                        ? s.url
                        : s.type === 'pdf'
                          ? `${s.fileName} · ${((s.fileSize ?? 0) / 1024).toFixed(0)} KB`
                          : 'Pasted text'}
                    </p>
                    {s.status === 'processing' && s.progress ? (
                      <p className="mt-1.5 text-xs text-brand-700">
                        {s.progress.stage === 'crawling'
                          ? `Crawling… ${s.progress.done} page${s.progress.done === 1 ? '' : 's'} fetched`
                          : s.progress.stage === 'embedding'
                            ? `Embedding ${s.progress.done}/${s.progress.total ?? '?'} chunks…`
                            : `${s.progress.stage[0]!.toUpperCase()}${s.progress.stage.slice(1)}…`}
                      </p>
                    ) : null}
                    {s.status === 'error' ? (
                      <p className="mt-1.5 text-xs text-red-600">{s.error}</p>
                    ) : null}
                    {s.status === 'ready' || (s.lastSyncedAt && s.status !== 'processing') ? (
                      <p className="mt-1.5 text-xs text-zinc-500">
                        {plural(s.documentCount, s.type === 'text' ? 'document' : 'page')} ·{' '}
                        {plural(s.chunkCount, 'chunk')} · ~{formatNumber(s.tokenCount)} tokens
                        {s.lastSyncedAt ? ` · synced ${timeAgo(s.lastSyncedAt)}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <form action={resyncSource.bind(null, bot.id, s.id)}>
                      <button
                        type="submit"
                        title="Re-sync"
                        aria-label={`Re-sync ${s.name}`}
                        disabled={s.status === 'processing'}
                        className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
                      >
                        <RefreshCw className="size-4" />
                      </button>
                    </form>
                    <form action={deleteSource.bind(null, bot.id, s.id)}>
                      <button
                        type="submit"
                        title="Delete"
                        aria-label={`Delete ${s.name}`}
                        className="rounded-md p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function plural(n: number, word: string) {
  return `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
}

function StatusBadge({ status }: { status: 'pending' | 'processing' | 'ready' | 'error' }) {
  if (status === 'ready') return <Badge tone="green">Ready</Badge>;
  if (status === 'error') return <Badge tone="red">Failed</Badge>;
  if (status === 'processing')
    return (
      <Badge tone="blue">
        <Loader2 className="size-3 animate-spin" /> Processing
      </Badge>
    );
  return <Badge tone="amber">Queued</Badge>;
}
