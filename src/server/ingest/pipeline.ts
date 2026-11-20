import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { bots, chunks, documents, sources, usageEvents, type Source, type SourceProgress } from "../db/schema";
import { estimateEmbeddingCost } from "../ai/models";
import type { EmbeddingProvider } from "../ai/types";
import type { Logger } from "../logger";
import { chunkMarkdown, embeddingText, sha256, type Chunk } from "./chunker";
import { crawlSite } from "./crawler";
import { extractPdf } from "./pdf";

export type IngestDeps = {
  db: Database;
  embeddings: EmbeddingProvider;
  allowPrivateNetworks: boolean;
  maxPagesCap: number;
  crawlTimeoutMs: number;
  logger: Logger;
  fetch?: typeof fetch;
};

type RawDoc = { title: string; url: string | null; page: number | null; markdown: string };
type PreparedChunk = Chunk & { docIndex: number; embedText: string; hash: string };

export class IngestError extends Error {}

async function setProgress(db: Database, id: string, progress: SourceProgress) {
  await db.update(sources).set({ progress, updatedAt: new Date() }).where(eq(sources.id, id));
}

async function loadDocuments(source: Source, deps: IngestDeps): Promise<RawDoc[]> {
  if (source.type === "website") {
    if (!source.url) throw new IngestError("Website source has no URL");
    const maxPages = Math.min((source.config as { maxPages?: number }).maxPages ?? 25, deps.maxPagesCap);
    let lastWrite = 0;
    const result = await crawlSite(source.url, {
      maxPages,
      allowPrivateNetworks: deps.allowPrivateNetworks,
      timeoutMs: deps.crawlTimeoutMs,
      fetch: deps.fetch,
      onProgress: async (p) => {
        if (Date.now() - lastWrite < 500) return;
        lastWrite = Date.now();
        await setProgress(deps.db, source.id, { stage: "crawling", done: p.done, total: maxPages, message: p.url });
      },
    });
    deps.logger.info("crawl finished", { sourceId: source.id, pages: result.pages.length, skipped: result.skipped.length, sitemap: result.usedSitemap });
    if (!result.pages.length) {
      const reasons = [...new Set(result.skipped.map((s) => s.reason))].slice(0, 3).join(", ");
      throw new IngestError(`No crawlable pages found${reasons ? ` (${reasons})` : ""}`);
    }
    return result.pages.map((p) => ({ title: p.title, url: p.url, page: null, markdown: p.markdown }));
  }
  if (source.type === "pdf") {
    if (!source.fileData) throw new IngestError("PDF source has no file");
    const pdf = await extractPdf(source.fileData);
    if (!pdf.pages.length) throw new IngestError("The PDF contains no extractable text (scanned PDFs need OCR, which is not supported yet)");
    const title = pdf.title ?? source.name;
    return pdf.pages.map((p) => ({ title, url: null, page: p.page, markdown: p.text }));
  }
  const text = source.textContent?.trim();
  if (!text) throw new IngestError("Text source is empty");
  return [{ title: source.name, url: null, page: null, markdown: text }];
}

/**
 * Loads → chunks → embeds a source, then atomically swaps its documents/chunks so the bot keeps
 * answering from the previous version until the new one is complete. Embeddings of unchanged
 * chunks are reused (keyed by content hash + model), so re-syncs only pay for what changed.
 */
export async function ingestSource(sourceId: string, deps: IngestDeps): Promise<{ documents: number; chunks: number; embedded: number; reused: number }> {
  const { db, embeddings, logger } = deps;
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId));
  if (!source) throw new IngestError("Source not found");
  const log = logger.child({ sourceId, botId: source.botId, type: source.type });
  const started = Date.now();

  await setProgress(db, sourceId, { stage: source.type === "website" ? "crawling" : "reading", done: 0, total: null });
  const docs = await loadDocuments(source, deps);

  const prepared: PreparedChunk[] = [];
  docs.forEach((doc, docIndex) => {
    for (const c of chunkMarkdown(doc.markdown)) {
      const embedText = embeddingText(doc.page ? `${doc.title} (page ${doc.page})` : doc.title, c);
      prepared.push({ ...c, docIndex, embedText, hash: sha256(embedText) });
    }
  });
  if (!prepared.length) throw new IngestError("No text could be extracted");

  // Reuse vectors for chunks we have already embedded with the same model.
  const reuse = new Map<string, number[]>();
  const hashes = [...new Set(prepared.map((p) => p.hash))];
  for (let i = 0; i < hashes.length; i += 500) {
    const rows = await db
      .select({ hash: chunks.contentHash, embedding: chunks.embedding })
      .from(chunks)
      .where(and(eq(chunks.botId, source.botId), eq(chunks.embeddingModel, embeddings.model), inArray(chunks.contentHash, hashes.slice(i, i + 500))));
    for (const r of rows) reuse.set(r.hash, r.embedding);
  }

  const todo = [...new Set(prepared.filter((p) => !reuse.has(p.hash)).map((p) => p.hash))];
  const textByHash = new Map(prepared.map((p) => [p.hash, p.embedText]));
  let inputTokens = 0;
  let estimated = false;
  const BATCH = 64;
  for (let i = 0; i < todo.length; i += BATCH) {
    await setProgress(db, sourceId, { stage: "embedding", done: i, total: todo.length });
    const batch = todo.slice(i, i + BATCH);
    const res = await embeddings.embed(batch.map((h) => textByHash.get(h)!));
    batch.forEach((h, j) => reuse.set(h, res.vectors[j]!));
    inputTokens += res.inputTokens;
    estimated ||= res.estimated;
  }

  await setProgress(db, sourceId, { stage: "saving", done: prepared.length, total: prepared.length });
  await db.transaction(async (tx) => {
    await tx.delete(documents).where(eq(documents.sourceId, sourceId));
    const docRows = await tx
      .insert(documents)
      .values(docs.map((d) => ({ sourceId, botId: source.botId, title: d.title, url: d.url, page: d.page, contentHash: sha256(d.markdown) })))
      .returning({ id: documents.id });
    const rows = prepared.map((p) => ({
      botId: source.botId,
      sourceId,
      documentId: docRows[p.docIndex]!.id,
      ordinal: p.ordinal,
      content: p.content,
      headingPath: p.headingPath,
      tokenCount: p.tokenCount,
      contentHash: p.hash,
      embedding: reuse.get(p.hash)!,
      embeddingModel: embeddings.model,
    }));
    for (let i = 0; i < rows.length; i += 100) await tx.insert(chunks).values(rows.slice(i, i + 100));
    await tx
      .update(sources)
      .set({
        status: "ready",
        error: null,
        progress: null,
        lockedAt: null,
        documentCount: docs.length,
        chunkCount: prepared.length,
        tokenCount: prepared.reduce((n, p) => n + p.tokenCount, 0),
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));
    await tx.update(bots).set({ embeddingModel: embeddings.model, embeddingDimensions: embeddings.dimensions, updatedAt: new Date() }).where(eq(bots.id, source.botId));
    if (todo.length) {
      await tx.insert(usageEvents).values({
        botId: source.botId,
        kind: "embedding",
        provider: embeddings.name,
        model: embeddings.model,
        inputTokens: Math.round(inputTokens),
        estimated,
        costUsd: estimateEmbeddingCost(embeddings.model, inputTokens),
      });
    }
  });

  const summary = { documents: docs.length, chunks: prepared.length, embedded: todo.length, reused: prepared.length - todo.length };
  log.info("source ingested", { ...summary, ms: Date.now() - started });
  return summary;
}

export async function markSourceFailed(db: Database, sourceId: string, message: string) {
  await db
    .update(sources)
    .set({ status: "error", error: message.slice(0, 500), progress: null, lockedAt: null, updatedAt: new Date() })
    .where(eq(sources.id, sourceId));
}

/** Atomically claims the next pending source (or one whose worker died) — safe across processes. */
export async function claimNextSource(db: Database): Promise<string | undefined> {
  const rows = await db
    .update(sources)
    .set({ status: "processing", lockedAt: new Date(), updatedAt: new Date() })
    .where(
      sql`${sources.id} = (
        SELECT id FROM sources
        WHERE status = 'pending' OR (status = 'processing' AND locked_at < now() - interval '15 minutes')
        ORDER BY updated_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )`,
    )
    .returning({ id: sources.id });
  return rows[0]?.id;
}
