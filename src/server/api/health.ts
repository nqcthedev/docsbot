import { sql } from 'drizzle-orm';

import { getDb } from 'src/server/db';
import { CONFIG } from 'src/config-global';
import { logger } from 'src/server/logger';
import { registry } from 'src/server/ai/registry';

// ----------------------------------------------------------------------

/** Liveness + database check for load balancers, Docker and the e2e test runner. */
export async function handleHealthRequest() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    const providers = registry();
    return Response.json({
      ok: true,
      version: CONFIG.appVersion,
      db: 'up',
      chatProviders: providers.configured,
      embeddings: providers.embeddings?.model ?? null,
    });
  } catch (error) {
    logger.error('health check failed', { err: error });
    return Response.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
