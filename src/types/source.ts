import type { Source } from 'src/server/db/schema';

// ----------------------------------------------------------------------

export type ISourceType = Source['type'];

export type ISourceStatus = Source['status'];

/** A row of the knowledge-sources list (file bytes and pasted text are never sent to the page). */
export type ISourceItem = Pick<
  Source,
  | 'id'
  | 'type'
  | 'name'
  | 'url'
  | 'fileName'
  | 'fileSize'
  | 'status'
  | 'error'
  | 'progress'
  | 'documentCount'
  | 'chunkCount'
  | 'tokenCount'
  | 'lastSyncedAt'
>;
