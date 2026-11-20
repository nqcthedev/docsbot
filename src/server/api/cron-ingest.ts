import { timingSafeEqual } from 'node:crypto';

import { env } from 'src/server/env';
import { drainIngestQueue } from 'src/server/ingest/queue';

// ----------------------------------------------------------------------

/** Sources per call, sized so a run fits the route's maxDuration on serverless hosts. */
const SOURCES_PER_RUN = 5;

// ----------------------------------------------------------------------

function isAuthorized(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Drains the ingestion queue. Point a scheduler (e.g. Vercel Cron) at it with `Authorization: Bearer $CRON_SECRET`. */
export async function handleCronIngestRequest(req: Request) {
  if (!isAuthorized(req))
    return Response.json({ error: { code: 'unauthorized' } }, { status: 401 });
  const processed = await drainIngestQueue(SOURCES_PER_RUN);
  return Response.json({ ok: true, processed });
}
