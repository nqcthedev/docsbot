import { createDatabase, type Database } from "@/server/db";
import { bots, users, workspaces } from "@/server/db/schema";
import { EMBEDDING_DIMENSIONS } from "@/server/db/schema";
import type { EmbeddingProvider } from "@/server/ai/types";

/** Fresh in-memory PGlite database with migrations applied. */
export async function testDb() {
  return createDatabase("pglite://memory", { migrate: true });
}

export async function seedBot(db: Database, overrides: Partial<typeof bots.$inferInsert> = {}) {
  const [user] = await db.insert(users).values({ email: `u${Math.random()}@example.com`, name: "Test", passwordHash: "x" }).returning();
  const [ws] = await db.insert(workspaces).values({ name: "WS", ownerId: user!.id }).returning();
  const [bot] = await db
    .insert(bots)
    .values({ workspaceId: ws!.id, name: "Test Bot", chatModel: "gemini-2.5-flash", ...overrides })
    .returning();
  return bot!;
}

/**
 * Deterministic bag-of-words embedding for tests: each known keyword maps to one dimension,
 * so cosine similarity reflects keyword overlap. No network involved.
 */
export function keywordEmbeddings(vocab: string[]): EmbeddingProvider & { calls: number } {
  const provider = {
    name: "openai" as const,
    model: "test-embedding",
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
      return { vectors, inputTokens: Math.ceil(texts.join(" ").length / 4), estimated: true };
    },
  };
  return provider;
}
