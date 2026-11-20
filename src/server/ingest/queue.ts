import { getDb } from "../db";
import { env } from "../env";
import { registry } from "../ai/registry";
import { ProviderError } from "../ai/types";
import { logger } from "../logger";
import { claimNextSource, IngestError, ingestSource, markSourceFailed } from "./pipeline";
import { BlockedUrlError } from "./url-guard";

const KEY = Symbol.for("docsbot.ingestDrain");
const AGAIN = Symbol.for("docsbot.ingestDrainAgain");
type G = typeof globalThis & { [KEY]?: Promise<number>; [AGAIN]?: boolean };

function userFacingError(err: unknown): string {
  if (err instanceof IngestError || err instanceof BlockedUrlError) return err.message;
  if (err instanceof ProviderError) return `Embedding provider error (${err.provider}${err.status ? ` ${err.status}` : ""}). Please retry the sync.`;
  return "Unexpected error while processing this source. Please retry the sync.";
}

async function drain(maxJobs: number): Promise<number> {
  const db = await getDb();
  const e = env();
  const embeddings = registry().embeddings;
  let processed = 0;
  while (processed < maxJobs) {
    const id = await claimNextSource(db);
    if (!id) break;
    processed++;
    if (!embeddings) {
      await markSourceFailed(db, id, "No embedding provider configured (set GEMINI_API_KEY or OPENAI_API_KEY).");
      continue;
    }
    try {
      await ingestSource(id, {
        db,
        embeddings,
        allowPrivateNetworks: e.CRAWLER_ALLOW_PRIVATE_NETWORKS,
        maxPagesCap: e.CRAWLER_MAX_PAGES,
        crawlTimeoutMs: e.CRAWLER_TIMEOUT_MS,
        logger,
      });
    } catch (err) {
      logger.error("ingestion failed", { sourceId: id, err });
      await markSourceFailed(db, id, userFacingError(err));
    }
  }
  return processed;
}

/**
 * Processes queued sources in this process. Concurrent calls share one drain loop; claims use
 * FOR UPDATE SKIP LOCKED so multiple processes/instances never ingest the same source twice.
 */
export function drainIngestQueue(maxJobs = 20): Promise<number> {
  const g = globalThis as G;
  if (g[KEY]) {
    // A drain is running; make sure it loops once more so a just-queued source is not missed.
    g[AGAIN] = true;
    return g[KEY];
  }
  const run = async (): Promise<number> => {
    let total = 0;
    do {
      g[AGAIN] = false;
      total += await drain(maxJobs).catch((err) => {
        logger.error("ingest queue drain crashed", { err });
        return 0;
      });
    } while (g[AGAIN]);
    return total;
  };
  g[KEY] = run().finally(() => {
    delete g[KEY];
  });
  return g[KEY];
}
