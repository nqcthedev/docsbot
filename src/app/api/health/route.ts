import { sql } from 'drizzle-orm';

import { getDb } from 'src/server/db';
import { registry } from 'src/server/ai/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    const r = registry();
    return Response.json({
      ok: true,
      db: 'up',
      chatProviders: r.configured,
      embeddings: r.embeddings?.model ?? null,
    });
  } catch {
    return Response.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
