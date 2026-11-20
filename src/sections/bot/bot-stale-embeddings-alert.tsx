import { AlertTriangle } from 'lucide-react';

import { formatNumber } from 'src/utils/format-number';

import { resyncAllSources } from 'src/actions/source';

import { Alert, Button } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  staleChunks: number;
  embeddingModel: string | undefined;
};

/** Shown after the embedding model changed: old vectors are not comparable with new ones. */
export function BotStaleEmbeddingsAlert({ botId, staleChunks, embeddingModel }: Props) {
  return (
    <Alert tone="amber" className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2">
        <AlertTriangle className="size-4" />
        {formatNumber(staleChunks)} chunks were embedded with a different model than the configured{' '}
        <code>{embeddingModel}</code>. They are excluded from search until you re-sync.
      </span>
      <form action={resyncAllSources.bind(null, botId)}>
        <Button size="sm" variant="outline">
          Re-sync all sources
        </Button>
      </form>
    </Alert>
  );
}
