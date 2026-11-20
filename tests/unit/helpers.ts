import type { Database } from 'src/server/db';
import type { EmbeddingProvider } from 'src/server/ai/types';

import { createDatabase } from 'src/server/db';
import { EMBEDDING_DIMENSIONS } from 'src/server/db/schema';
import { bots, users, workspaces } from 'src/server/db/schema';

/**
 * Fresh database with migrations applied: in-memory PGlite by default, or a throwaway database
 * on a real Postgres + pgvector server when TEST_DATABASE_URL is set (used in CI).
 */
export async function testDb() {
  const admin = process.env.TEST_DATABASE_URL;
  if (!admin) return createDatabase('pglite://memory', { migrate: true });
  const name = `docsbot_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const postgres = (await import('postgres')).default;
  const sqlAdmin = postgres(admin, { max: 1, onnotice: () => {} });
  await sqlAdmin.unsafe(`CREATE DATABASE ${name}`);
  const url = new URL(admin);
  url.pathname = `/${name}`;
  const handle = await createDatabase(url.toString(), { migrate: true });
  return {
    ...handle,
    close: async () => {
      await handle.close();
      await sqlAdmin.unsafe(`DROP DATABASE IF EXISTS ${name}`);
      await sqlAdmin.end();
    },
  };
}

export async function seedBot(db: Database, overrides: Partial<typeof bots.$inferInsert> = {}) {
  const [user] = await db
    .insert(users)
    .values({ email: `u${Math.random()}@example.com`, name: 'Test', passwordHash: 'x' })
    .returning();
  const [ws] = await db.insert(workspaces).values({ name: 'WS', ownerId: user!.id }).returning();
  const [bot] = await db
    .insert(bots)
    .values({ workspaceId: ws!.id, name: 'Test Bot', chatModel: 'gemini-2.5-flash', ...overrides })
    .returning();
  return bot!;
}

/**
 * Deterministic bag-of-words embedding for tests: each known keyword maps to one dimension,
 * so cosine similarity reflects keyword overlap. No network involved.
 */
export function keywordEmbeddings(vocab: string[]): EmbeddingProvider & { calls: number } {
  const provider = {
    name: 'openai' as const,
    model: 'test-embedding',
    dimensions: EMBEDDING_DIMENSIONS,
    calls: 0,
    async embed(texts: string[]) {
      provider.calls++;
      const vectors = texts.map((t) => {
        const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
        const lower = t.toLowerCase();
        vocab.forEach((w, i) => {
          if (lower.includes(w)) v[i] = 1;
        });
        v[EMBEDDING_DIMENSIONS - 1] = 0.05; // avoid zero vectors
        const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        return v.map((x) => x / norm);
      });
      return { vectors, inputTokens: Math.ceil(texts.join(' ').length / 4), estimated: true };
    },
  };
  return provider;
}
