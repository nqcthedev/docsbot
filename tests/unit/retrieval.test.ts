import type { Database } from 'src/server/db';

import { it, expect, afterAll, describe, beforeAll } from 'vitest';

import { logger } from 'src/server/logger';
import { sources } from 'src/server/db/schema';
import { ingestSource } from 'src/server/ingest/pipeline';
import {
  retrieve,
  fuseResults,
  filterContext,
  assessConfidence,
  buildKeywordQuery,
} from 'src/server/rag/retrieve';

import { testDb, seedBot, keywordEmbeddings } from './helpers';

const c = (id: string, extra: { similarity?: number; keywordRank?: number } = {}) => ({
  id,
  content: id,
  headingPath: '',
  title: id,
  url: null,
  page: null,
  ...extra,
});

describe('pure retrieval logic', () => {
  it('builds a sanitised OR tsquery without stopwords or operators', () => {
    expect(buildKeywordQuery('How much is shipping to Canada?!')).toBe('much | shipping | canada');
    expect(buildKeywordQuery("'); DROP TABLE chunks; -- & | !")).toBe('drop | table | chunks');
    expect(buildKeywordQuery('is it the')).toBeUndefined();
  });

  it('fuses vector and keyword rankings with RRF', () => {
    const fused = fuseResults(
      [c('a', { similarity: 0.9 }), c('b', { similarity: 0.8 })],
      [c('b', { keywordRank: 0.5 }), c('k', { keywordRank: 0.4 })],
      3
    );
    expect(fused.map((f) => f.id)).toEqual(['b', 'a', 'k']);
    expect(fused[0]).toMatchObject({ similarity: 0.8, keywordRank: 0.5 });
    expect(fused[2]).toMatchObject({ similarity: null, keywordRank: 0.4 });
  });

  it('is confident only when the best vector hit clears the threshold', () => {
    expect(assessConfidence([{ similarity: 0.61 }, { similarity: 0.3 }], 0.6)).toEqual({
      topSimilarity: 0.61,
      confident: true,
    });
    expect(assessConfidence([{ similarity: 0.59 }], 0.6).confident).toBe(false);
    expect(assessConfidence([], 0.1)).toEqual({ topSimilarity: 0, confident: false });
  });

  it('drops weak vector-only hits but keeps keyword hits', () => {
    const results = [
      { ...c('strong'), similarity: 0.7, keywordRank: null, score: 1 },
      { ...c('weak'), similarity: 0.3, keywordRank: null, score: 1 },
      { ...c('kw'), similarity: null, keywordRank: 0.2, score: 1 },
    ];
    expect(filterContext(results, 0.6).map((r) => r.id)).toEqual(['strong', 'kw']);
  });
});

describe('retrieve() against Postgres + pgvector (PGlite)', () => {
  let db: Database;
  let close: () => Promise<void>;
  let botId: string;
  const emb = keywordEmbeddings([
    'shipping',
    'canada',
    'refund',
    'espresso',
    'grind',
    'subscription',
  ]);

  beforeAll(async () => {
    const h = await testDb();
    db = h.db;
    close = h.close;
    const bot = await seedBot(db);
    botId = bot.id;
    const [src] = await db
      .insert(sources)
      .values({
        botId,
        type: 'text',
        name: 'Help Center',
        textContent: [
          '# Shipping\n\nShipping to Canada costs $16 flat.',
          '# Refunds\n\nRefund requests are accepted within 30 days.',
          '# Espresso\n\nUse a fine grind for espresso: 18 g in, 36 g out.',
          '# Subscriptions\n\nSubscription orders save 10%.',
        ].join('\n\n' + 'filler text. '.repeat(120) + '\n\n'),
      })
      .returning();
    const res = await ingestSource(src!.id, {
      db,
      embeddings: emb,
      allowPrivateNetworks: true,
      maxPagesCap: 10,
      crawlTimeoutMs: 1000,
      logger,
    });
    expect(res.chunks).toBeGreaterThan(3);
  });
  afterAll(() => close());

  it('ranks the matching chunk first and reports confidence', async () => {
    const [q] = (await emb.embed(['shipping to canada'])).vectors;
    const r = await retrieve(db, {
      botId,
      embeddingModel: 'test-embedding',
      queryVectors: [q!],
      queryText: 'shipping to canada',
      topK: 3,
      minSimilarity: 0.5,
    });
    expect(r.confidence.confident).toBe(true);
    expect(r.chunks[0]!.content).toContain('$16 flat');
    expect(r.chunks[0]!.title).toBe('Help Center');
  });

  it('is not confident for unrelated questions', async () => {
    const [q] = (await emb.embed(['do you sell teapots'])).vectors;
    const r = await retrieve(db, {
      botId,
      embeddingModel: 'test-embedding',
      queryVectors: [q!],
      queryText: 'do you sell teapots',
      topK: 3,
      minSimilarity: 0.5,
    });
    expect(r.confidence.confident).toBe(false);
  });

  it('never compares vectors produced by a different embedding model', async () => {
    const [q] = (await emb.embed(['shipping canada'])).vectors;
    const r = await retrieve(db, {
      botId,
      embeddingModel: 'some-other-model',
      queryVectors: [q!],
      queryText: 'zzz',
      topK: 3,
      minSimilarity: 0.1,
    });
    expect(r.chunks).toEqual([]);
    expect(r.confidence.confident).toBe(false);
  });

  it('re-ingesting unchanged content reuses stored embeddings', async () => {
    const [src] = await db.select().from(sources);
    const before = emb.calls;
    const res = await ingestSource(src!.id, {
      db,
      embeddings: emb,
      allowPrivateNetworks: true,
      maxPagesCap: 10,
      crawlTimeoutMs: 1000,
      logger,
    });
    expect(res.embedded).toBe(0);
    expect(res.reused).toBe(res.chunks);
    expect(emb.calls).toBe(before);
  });
});
