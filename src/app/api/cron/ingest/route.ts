import { timingSafeEqual } from 'node:crypto';

import { env } from 'src/server/env';
import { drainIngestQueue } from 'src/server/ingest/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Drains the ingestion queue. Point a scheduler (e.g. Vercel Cron) at it with `Authorization: Bearer $CRON_SECRET`. */
async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: { code: 'unauthorized' } }, { status: 401 });
  const processed = await drainIngestQueue(5);
  return Response.json({ ok: true, processed });
}

export const GET = handle;
export const POST = handle;
