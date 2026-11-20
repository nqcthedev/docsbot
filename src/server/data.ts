import 'server-only';

import type { Bot } from './db/schema';
import type { CurrentUser } from './auth/session';

import { notFound, redirect } from 'next/navigation';
import { eq, ne, and, gte, sql, sum, desc, count, inArray } from 'drizzle-orm';

import { getDb, queryRows } from './db';
import { registry } from './ai/registry';
import { getCurrentUser } from './auth/session';
import { bots, leads, chunks, sources, messages, usageEvents, conversations } from './db/schema';

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Loads a bot the current user owns, or 404s (never reveals other tenants' bots). */
export async function requireBot(botId: string): Promise<{ user: CurrentUser; bot: Bot }> {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(botId)) notFound();
  const db = await getDb();
  const [bot] = await db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, user.workspaceId)));
  if (!bot) notFound();
  return { user, bot };
}

export async function listBotsWithStats(workspaceId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bots)
    .where(eq(bots.workspaceId, workspaceId))
    .orderBy(desc(bots.createdAt));
  if (!rows.length) return [];
  const ids = rows.map((b) => b.id);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [convs, leadRows, srcRows, cost] = await Promise.all([
    db
      .select({ botId: conversations.botId, n: count() })
      .from(conversations)
      .where(and(inArray(conversations.botId, ids), gte(conversations.createdAt, since)))
      .groupBy(conversations.botId),
    db
      .select({ botId: leads.botId, n: count() })
      .from(leads)
      .where(inArray(leads.botId, ids))
      .groupBy(leads.botId),
    db
      .select({ botId: sources.botId, n: count(), chunks: sum(sources.chunkCount) })
      .from(sources)
      .where(inArray(sources.botId, ids))
      .groupBy(sources.botId),
    db
      .select({ botId: usageEvents.botId, usd: sum(usageEvents.costUsd) })
      .from(usageEvents)
      .where(and(inArray(usageEvents.botId, ids), gte(usageEvents.createdAt, since)))
      .groupBy(usageEvents.botId),
  ]);
  const by = <T extends { botId: string }>(list: T[]) => new Map(list.map((r) => [r.botId, r]));
  const c = by(convs);
  const l = by(leadRows);
  const s = by(srcRows);
  const u = by(cost);
  return rows.map((bot) => ({
    bot,
    conversations30d: Number(c.get(bot.id)?.n ?? 0),
    leads: Number(l.get(bot.id)?.n ?? 0),
    sources: Number(s.get(bot.id)?.n ?? 0),
    chunks: Number(s.get(bot.id)?.chunks ?? 0),
    cost30d: Number(u.get(bot.id)?.usd ?? 0),
  }));
}

export async function listSources(botId: string) {
  const db = await getDb();
  return db
    .select({
      id: sources.id,
      type: sources.type,
      name: sources.name,
      url: sources.url,
      fileName: sources.fileName,
      fileSize: sources.fileSize,
      status: sources.status,
      error: sources.error,
      progress: sources.progress,
      documentCount: sources.documentCount,
      chunkCount: sources.chunkCount,
      tokenCount: sources.tokenCount,
      lastSyncedAt: sources.lastSyncedAt,
      createdAt: sources.createdAt,
      config: sources.config,
    })
    .from(sources)
    .where(eq(sources.botId, botId))
    .orderBy(desc(sources.createdAt));
}

/** Chunks embedded with a model other than the one currently configured (need a re-sync). */
export async function staleChunkCount(botId: string) {
  const model = registry().embeddings?.model;
  if (!model) return 0;
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(chunks)
    .where(and(eq(chunks.botId, botId), ne(chunks.embeddingModel, model)));
  return Number(row?.n ?? 0);
}

export type BotAnalytics = Awaited<ReturnType<typeof botAnalytics>>;

export async function botAnalytics(botId: string, days = 30) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 86_400_000);
  const assistant = and(
    eq(messages.botId, botId),
    eq(messages.role, 'assistant'),
    gte(messages.createdAt, since)
  );

  const [convCount, outcomeRows, leadCount, usageRows, daily, topQuestions, unanswered] =
    await Promise.all([
      db
        .select({ n: count() })
        .from(conversations)
        .where(and(eq(conversations.botId, botId), gte(conversations.createdAt, since))),
      db
        .select({ outcome: messages.outcome, n: count() })
        .from(messages)
        .where(assistant)
        .groupBy(messages.outcome),
      db
        .select({ n: count() })
        .from(leads)
        .where(and(eq(leads.botId, botId), gte(leads.createdAt, since))),
      db
        .select({
          kind: usageEvents.kind,
          model: usageEvents.model,
          input: sum(usageEvents.inputTokens),
          output: sum(usageEvents.outputTokens),
          usd: sum(usageEvents.costUsd),
          n: count(),
        })
        .from(usageEvents)
        .where(and(eq(usageEvents.botId, botId), gte(usageEvents.createdAt, since)))
        .groupBy(usageEvents.kind, usageEvents.model),
      queryRows<{ day: string; conversations: number }>(
        db,
        sql`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS conversations
          FROM conversations WHERE bot_id = ${botId} AND created_at >= ${since.toISOString()}
          GROUP BY 1 ORDER BY 1`
      ),
      // "Top questions": user messages grouped by a normalised form of the text.
      queryRows<{ question: string; asked: number; last_asked: string }>(
        db,
        sql`SELECT min(content) AS question, count(*)::int AS asked, max(created_at)::text AS last_asked
          FROM messages WHERE bot_id = ${botId} AND role = 'user' AND created_at >= ${since.toISOString()}
          GROUP BY lower(regexp_replace(trim(content), '[[:punct:][:space:]]+', ' ', 'g'))
          ORDER BY asked DESC, last_asked DESC LIMIT 8`
      ),
      // Unanswered: the user question that preceded each declined assistant reply.
      queryRows<{
        question: string;
        outcome: string;
        created_at: string;
        conversation_id: string;
        confidence: number | null;
      }>(
        db,
        sql`SELECT (SELECT u.content FROM messages u WHERE u.conversation_id = a.conversation_id AND u.role = 'user' AND u.created_at <= a.created_at ORDER BY u.created_at DESC LIMIT 1) AS question,
                 a.outcome, a.created_at::text AS created_at, a.conversation_id, a.confidence
          FROM messages a
          WHERE a.bot_id = ${botId} AND a.role = 'assistant' AND a.outcome IN ('low_confidence', 'no_answer') AND a.created_at >= ${since.toISOString()}
          ORDER BY a.created_at DESC LIMIT 8`
      ),
    ]);

  const outcomes = Object.fromEntries(
    outcomeRows.map((r) => [r.outcome ?? 'unknown', Number(r.n)])
  ) as Record<string, number>;
  const replies = Object.values(outcomes).reduce((a, b) => a + b, 0);
  const unansweredCount = (outcomes.low_confidence ?? 0) + (outcomes.no_answer ?? 0);
  const usage = usageRows.map((r) => ({
    kind: r.kind,
    model: r.model,
    inputTokens: Number(r.input ?? 0),
    outputTokens: Number(r.output ?? 0),
    costUsd: Number(r.usd ?? 0),
    calls: Number(r.n),
  }));

  // Fill missing days so the chart has a bar for every day in range.
  const dayMap = new Map(daily.map((d) => [d.day, Number(d.conversations)]));
  const series: { day: string; conversations: number }[] = [];
  for (let i = Math.min(days, 14) - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    series.push({ day: d, conversations: dayMap.get(d) ?? 0 });
  }

  return {
    days,
    conversations: Number(convCount[0]?.n ?? 0),
    replies,
    answered: outcomes.answered ?? 0,
    unanswered: unansweredCount,
    handoffs: outcomes.handoff ?? 0,
    errors: outcomes.error ?? 0,
    answerRate: replies ? (outcomes.answered ?? 0) / replies : null,
    leads: Number(leadCount[0]?.n ?? 0),
    usage,
    totalCost: usage.reduce((a, u) => a + u.costUsd, 0),
    totalTokens: usage.reduce((a, u) => a + u.inputTokens + u.outputTokens, 0),
    series,
    topQuestions: topQuestions.map((q) => ({ question: q.question, asked: Number(q.asked) })),
    unansweredQuestions: unanswered
      .filter((u) => u.question)
      .map((u) => ({
        question: u.question,
        outcome: u.outcome,
        createdAt: u.created_at,
        conversationId: u.conversation_id,
        confidence: u.confidence,
      })),
  };
}
