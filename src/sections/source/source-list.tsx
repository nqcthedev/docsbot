import type { ISourceItem } from 'src/types/source';

import { Globe, Loader2 } from 'lucide-react';

import { CONFIG } from 'src/config-global';

import { AutoRefresh } from 'src/components/auto-refresh';
import { Card, CardHeader, EmptyState } from 'src/components/ui';

import { SourceItem } from './source-item';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  sources: ISourceItem[];
};

export function SourceList({ botId, sources }: Props) {
  // While a job is queued or running, poll so status and progress update without a reload.
  const isBusy = sources.some(
    (source) => source.status === 'pending' || source.status === 'processing'
  );

  return (
    <Card className="lg:col-span-3">
      <CardHeader
        title="Knowledge sources"
        description="Everything the bot is allowed to answer from."
        action={
          isBusy ? (
            <span className="flex items-center gap-1.5 text-xs text-brand-600">
              <Loader2 className="size-3.5 animate-spin" /> Processing
            </span>
          ) : null
        }
      />
      {isBusy ? <AutoRefresh intervalMs={CONFIG.sourcesPollIntervalMs} /> : null}
      {sources.length === 0 ? (
        <EmptyState icon={<Globe />} title="No sources yet">
          Add your website, a PDF or some FAQ text. The bot only answers from what you add here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-100" data-testid="sources-list">
          {sources.map((source) => (
            <SourceItem key={source.id} botId={botId} source={source} />
          ))}
        </ul>
      )}
    </Card>
  );
}
