import type { ISourceItem } from 'src/types/source';
import type { SourceProgress } from 'src/server/db/schema';

import { formatCount, formatNumber } from 'src/utils/format-number';

// ----------------------------------------------------------------------

const BYTES_PER_KB = 1024;

/** Where a source's content comes from: its URL, the uploaded file, or pasted text. */
export function describeSourceOrigin(
  source: Pick<ISourceItem, 'type' | 'url' | 'fileName' | 'fileSize'>
) {
  switch (source.type) {
    case 'website':
      return source.url ?? '';
    case 'pdf':
      return `${source.fileName} · ${((source.fileSize ?? 0) / BYTES_PER_KB).toFixed(0)} KB`;
    case 'text':
      return 'Pasted text';
    default: {
      const unhandled: never = source.type;
      return unhandled;
    }
  }
}

// ----------------------------------------------------------------------

/** Live status line of a running ingestion job. */
export function describeSourceProgress({ stage, done, total }: SourceProgress) {
  if (stage === 'crawling') return `Crawling… ${done} page${done === 1 ? '' : 's'} fetched`;
  if (stage === 'embedding') return `Embedding ${done}/${total ?? '?'} chunks…`;
  return `${stage.charAt(0).toUpperCase()}${stage.slice(1)}…`;
}

// ----------------------------------------------------------------------

/** "14 pages · 52 chunks · ~9,800 tokens" for an ingested source. */
export function describeSourceContents(
  source: Pick<ISourceItem, 'type' | 'documentCount' | 'chunkCount' | 'tokenCount'>
) {
  const documentNoun = source.type === 'text' ? 'document' : 'page';
  return [
    formatCount(source.documentCount, documentNoun),
    formatCount(source.chunkCount, 'chunk'),
    `~${formatNumber(source.tokenCount)} tokens`,
  ].join(' · ');
}
