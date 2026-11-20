import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { chunks, documents } from "../db/schema";

export type RetrievedChunk = {
  id: string;
  content: string;
  headingPath: string;
  title: string;
  url: string | null;
  page: number | null;
  /** Cosine similarity of the chunk to the query (null when only matched by keyword search). */
  similarity: number | null;
  keywordRank: number | null;
  score: number;
};

type Candidate = Omit<RetrievedChunk, "score" | "similarity" | "keywordRank"> & { similarity?: number; keywordRank?: number };

const STOPWORDS = new Set(
  "a an and are as at be but by can could do does for from had has have how i if in into is it its me my no not of on or our please should so than that the their them then there these they this to us was we were what when where which who why will with would you your".split(" "),
);

/** Builds an OR-ed tsquery from free text. Only [a-z0-9] terms survive, so user input can never inject tsquery syntax. */
export function buildKeywordQuery(text: string): string | undefined {
  const terms = [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((t) => t.length > 1 && !STOPWORDS.has(t)).slice(0, 16);
  return terms.length ? terms.join(" | ") : undefined;
}

/** Reciprocal Rank Fusion: score = Σ 1 / (k + rank). Robust to the different scales of cosine and ts_rank. */
export function fuseResults(vector: Candidate[], keyword: Candidate[], topK: number, k = 60): RetrievedChunk[] {
  const merged = new Map<string, RetrievedChunk>();
  vector.forEach((c, i) => {
    merged.set(c.id, { ...c, similarity: c.similarity ?? null, keywordRank: null, score: 1 / (k + i + 1) });
  });
  keyword.forEach((c, i) => {
    const existing = merged.get(c.id);
    const add = 1 / (k + i + 1);
    if (existing) {
      existing.score += add;
      existing.keywordRank = c.keywordRank ?? null;
    } else {
      merged.set(c.id, { ...c, similarity: null, keywordRank: c.keywordRank ?? null, score: add });
    }
  });
  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}

export type Confidence = { topSimilarity: number; confident: boolean };

/** The gate that makes the bot say "I don't know" instead of guessing from weakly related text. */
export function assessConfidence(vectorHits: { similarity?: number | null }[], minSimilarity: number): Confidence {
  const topSimilarity = vectorHits.reduce((m, h) => Math.max(m, h.similarity ?? 0), 0);
  return { topSimilarity, confident: vectorHits.length > 0 && topSimilarity >= minSimilarity };
}

/**
 * Drops weak vector-only hits from the context: anything well below the confidence threshold
 * is noise that invites hallucination. Keyword hits are kept (exact terms like SKUs matter).
 */
export function filterContext(results: RetrievedChunk[], minSimilarity: number, margin = 0.12): RetrievedChunk[] {
  return results.filter((r) => r.keywordRank !== null || (r.similarity ?? 0) >= minSimilarity - margin);
}

export async function retrieve(
  db: Database,
  params: { botId: string; embeddingModel: string; queryVectors: number[][]; queryText: string; topK: number; minSimilarity: number; candidates?: number },
): Promise<{ chunks: RetrievedChunk[]; confidence: Confidence }> {
  const limit = params.candidates ?? 20;
  const base = {
    id: chunks.id,
    content: chunks.content,
    headingPath: chunks.headingPath,
    title: documents.title,
    url: documents.url,
    page: documents.page,
  };
  const scope = and(eq(chunks.botId, params.botId), eq(chunks.embeddingModel, params.embeddingModel));

  // One nearest-neighbour search per query vector; a chunk keeps its best similarity.
  const best = new Map<string, Omit<RetrievedChunk, "score" | "keywordRank"> & { similarity: number }>();
  for (const vector of params.queryVectors) {
    const distance = sql<number>`(${chunks.embedding} <=> ${JSON.stringify(vector)}::vector)`;
    const rows = await db
      .select({ ...base, similarity: sql<number>`1 - ${distance}` })
      .from(chunks)
      .innerJoin(documents, eq(documents.id, chunks.documentId))
      .where(scope)
      .orderBy(distance)
      .limit(limit);
    for (const r of rows) {
      const sim = Number(r.similarity);
      const prev = best.get(r.id);
      if (!prev || sim > prev.similarity) best.set(r.id, { ...r, similarity: sim });
    }
  }
  const vectorHits = [...best.values()].sort((a, b) => b.similarity - a.similarity).slice(0, limit);

  const tsq = buildKeywordQuery(params.queryText);
  const keywordRows = tsq
    ? await db
        .select({ ...base, keywordRank: sql<number>`ts_rank_cd(${chunks.tsv}, to_tsquery('english', ${tsq}))` })
        .from(chunks)
        .innerJoin(documents, eq(documents.id, chunks.documentId))
        .where(and(scope, sql`${chunks.tsv} @@ to_tsquery('english', ${tsq})`))
        .orderBy(desc(sql`ts_rank_cd(${chunks.tsv}, to_tsquery('english', ${tsq}))`))
        .limit(limit)
    : [];

  const confidence = assessConfidence(vectorHits, params.minSimilarity);
  const fused = fuseResults(
    vectorHits,
    keywordRows.map((r) => ({ ...r, keywordRank: Number(r.keywordRank) })),
    params.topK,
  );
  const simById = new Map(vectorHits.map((v) => [v.id, v.similarity]));
  for (const f of fused) if (f.similarity === null && simById.has(f.id)) f.similarity = simById.get(f.id)!;
  return { chunks: filterContext(fused, params.minSimilarity), confidence };
}
