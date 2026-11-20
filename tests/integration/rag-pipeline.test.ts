import type http from 'node:http';
import type { Database } from 'src/server/db';
import type { Bot } from 'src/server/db/schema';
import type { AnswerEvent } from 'src/server/rag/answer';
import type { ProviderRegistry } from 'src/server/ai/registry';

import { eq } from 'drizzle-orm';
/**
 * End-to-end RAG pipeline against the real AI provider:
 *   crawl the local Northwind fixture site + ingest the wholesale PDF → embed (Gemini/OpenAI)
 *   → store in Postgres/pgvector (PGlite) → ask questions → check grounded answers & citations.
 * Skipped automatically when no provider key is configured. Uses the cheapest model and
 * makes ~2 embedding batches plus 5 chat calls.
 */
import { existsSync, readFileSync } from 'node:fs';
import { it, expect, afterAll, describe, beforeAll } from 'vitest';

import { envSchema } from 'src/server/env';
import { logger } from 'src/server/logger';
import { answerQuestion } from 'src/server/rag/answer';
import { buildRegistry } from 'src/server/ai/registry';
import { ingestSource } from 'src/server/ingest/pipeline';
import { bots, chunks, sources, usageEvents, conversations } from 'src/server/db/schema';

import { testDb, seedBot } from '../unit/helpers';
import { startFixtureServer } from '../../fixtures/northwind/server';

if (existsSync('.env')) process.loadEnvFile('.env');
const env = envSchema.parse(process.env);
const hasProvider = Boolean(env.GEMINI_API_KEY || env.OPENAI_API_KEY);
const CHAT_MODEL = env.GEMINI_API_KEY ? 'gemini-3.5-flash-lite' : 'gpt-4o-mini';

describe.skipIf(!hasProvider)('RAG pipeline with a live AI provider', () => {
  let server: http.Server & { url: string };
  let db: Database;
  let close: () => Promise<void>;
  let bot: Bot;
  let registry: ProviderRegistry;

  beforeAll(async () => {
    server = await startFixtureServer({ port: 0 });
    ({ db, close } = await testDb());
    registry = buildRegistry(env);
    bot = await seedBot(db, {
      name: 'Northwind Assistant',
      chatModel: CHAT_MODEL,
      minSimilarity: 0.5,
    });
    const pdf = readFileSync('fixtures/northwind/northwind-wholesale-guide.pdf');
    const inserted = await db
      .insert(sources)
      .values([
        {
          botId: bot.id,
          type: 'website',
          name: 'Northwind site',
          url: server.url,
          config: { maxPages: 30 },
        },
        {
          botId: bot.id,
          type: 'pdf',
          name: 'Wholesale guide',
          fileName: 'northwind-wholesale-guide.pdf',
          fileData: pdf,
          fileSize: pdf.length,
        },
      ])
      .returning({ id: sources.id });
    for (const s of inserted) {
      await ingestSource(s.id, {
        db,
        embeddings: registry.embeddings!,
        allowPrivateNetworks: true,
        maxPagesCap: 50,
        crawlTimeoutMs: 10_000,
        logger,
      });
    }
    [bot] = (await db.select().from(bots).where(eq(bots.id, bot.id))) as [Bot];
  });

  afterAll(async () => {
    await close?.();
    await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  });

  async function ask(question: string) {
    const [conv] = await db
      .insert(conversations)
      .values({ botId: bot.id, visitorId: 'integration', channel: 'widget' })
      .returning();
    const events: AnswerEvent[] = [];
    const res = await answerQuestion({
      db,
      registry,
      bot,
      conversationId: conv!.id,
      question,
      history: [],
      emit: (e) => void events.push(e),
      logger,
      fallbackOptions: { maxRetries: 3, baseDelayMs: 2000 },
      fallbackModels: 'gemini-2.5-flash',
    });
    const done = events.find((e) => e.type === 'done') as Extract<AnswerEvent, { type: 'done' }>;
    console.log(
      `\nQ: ${question}\nA: ${res.text}\n   outcome=${res.outcome} similarity=${done.confidence?.toFixed(3)} citations=${JSON.stringify(res.citations.map((c) => c.url ?? `${c.title} p.${c.page}`))}`
    );
    return { ...res, done };
  }

  it('ingested the site (respecting robots.txt) and the PDF', async () => {
    const all = await db
      .select({ content: chunks.content, model: chunks.embeddingModel })
      .from(chunks)
      .where(eq(chunks.botId, bot.id));
    expect(all.length).toBeGreaterThan(15);
    expect(all.every((c) => c.model === registry.embeddings!.model)).toBe(true);
    expect(all.some((c) => c.content.includes('NW-STAFF-ONLY'))).toBe(false);
    expect(bot.embeddingModel).toBe(registry.embeddings!.model);
    expect(bot.embeddingDimensions).toBe(1536);
  });

  it('answers a page-specific question with a citation to that page', async () => {
    const r = await ask('How much does shipping to Canada cost?');
    expect(r.outcome).toBe('answered');
    expect(r.text).toMatch(/\$?16(\.00)?/);
    expect(r.citations.some((c) => c.url?.endsWith('/shipping'))).toBe(true);
  });

  it('answers from the PDF and cites the page number', async () => {
    const r = await ask('What is the minimum order quantity for wholesale accounts?');
    expect(r.outcome).toBe('answered');
    expect(r.text).toMatch(/10\s*(lb|pounds)/i);
    expect(r.citations.some((c) => c.page === 1 && c.url === null)).toBe(true);
  });

  it('finds a detail that only exists on one deep page', async () => {
    const r = await ask('How long should cold brew steep?');
    expect(r.outcome).toBe('answered');
    expect(r.text).toMatch(/18 hours/i);
    expect(r.citations.some((c) => c.url?.endsWith('/brewing/cold-brew'))).toBe(true);
  });

  it('declines and offers lead capture for questions the docs do not cover', async () => {
    const r = await ask('Do you offer a student discount?');
    expect(r.outcome === 'no_answer' || r.outcome === 'low_confidence').toBe(true);
    expect(r.done.offerLead).toBe(true);
    expect(r.text).toBe(bot.fallbackMessage);
  });

  it('never leaks content from robots-disallowed pages', async () => {
    const r = await ask('What is the staff discount code?');
    expect(r.text).not.toContain('NW-STAFF');
    expect(r.outcome).not.toBe('answered');
  });

  it('recorded token usage and estimated cost', async () => {
    const usage = await db.select().from(usageEvents).where(eq(usageEvents.botId, bot.id));
    expect(usage.some((u) => u.kind === 'embedding' && u.inputTokens > 0)).toBe(true);
    expect(usage.some((u) => u.kind === 'chat' && u.inputTokens > 0 && u.outputTokens > 0)).toBe(
      true
    );
  });
});
