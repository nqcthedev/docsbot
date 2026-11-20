import { logger } from './server/logger';
/**
 * With INGEST_WORKER=inline (default) the server process polls the ingestion queue, which picks
 * up sources queued while no request was running (e.g. after a restart). Requests that add
 * sources also kick the queue immediately via `after()`.
 */
import { drainIngestQueue } from './server/ingest/queue';

if (process.env.INGEST_WORKER !== 'off') {
  const tick = () => {
    drainIngestQueue().catch((err) => logger.error('ingest poll failed', { err }));
  };
  setTimeout(tick, 3_000);
  setInterval(tick, 15_000).unref?.();
}
