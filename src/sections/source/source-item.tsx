import type { ISourceItem, ISourceType } from 'src/types/source';

import { Type, Globe, Trash2, FileText, RefreshCw } from 'lucide-react';

import { formatTimeAgo } from 'src/utils/format-time';

import { deleteSource, resyncSource } from 'src/actions/source';

import { SourceStatusBadge } from './source-status-badge';
import { describeSourceOrigin, describeSourceContents, describeSourceProgress } from './utils';

// ----------------------------------------------------------------------

const SOURCE_ICONS: Record<ISourceType, typeof Globe> = {
  website: Globe,
  pdf: FileText,
  text: Type,
};

type Props = {
  botId: string;
  source: ISourceItem;
};

export function SourceItem({ botId, source }: Props) {
  const Icon = SOURCE_ICONS[source.type];
  const isProcessing = source.status === 'processing';
  // A failed re-sync keeps the figures of the last successful one, so show those too.
  const hasContents = source.status === 'ready' || (source.lastSyncedAt !== null && !isProcessing);

  return (
    <li
      className="flex items-start gap-3 px-5 py-4"
      data-testid="source-row"
      data-status={source.status}
    >
      <span className="mt-0.5 rounded-lg bg-zinc-100 p-2 text-zinc-600">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-zinc-900">{source.name}</p>
          <SourceStatusBadge status={source.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{describeSourceOrigin(source)}</p>
        {isProcessing && source.progress ? (
          <p className="mt-1.5 text-xs text-brand-700">{describeSourceProgress(source.progress)}</p>
        ) : null}
        {source.status === 'error' ? (
          <p className="mt-1.5 text-xs text-red-600">{source.error}</p>
        ) : null}
        {hasContents ? (
          <p className="mt-1.5 text-xs text-zinc-500">
            {describeSourceContents(source)}
            {source.lastSyncedAt ? ` · synced ${formatTimeAgo(source.lastSyncedAt)}` : ''}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        <form action={resyncSource.bind(null, botId, source.id)}>
          <button
            type="submit"
            title="Re-sync"
            aria-label={`Re-sync ${source.name}`}
            disabled={isProcessing}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
          >
            <RefreshCw className="size-4" />
          </button>
        </form>
        <form action={deleteSource.bind(null, botId, source.id)}>
          <button
            type="submit"
            title="Delete"
            aria-label={`Delete ${source.name}`}
            className="rounded-md p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="size-4" />
          </button>
        </form>
      </div>
    </li>
  );
}
