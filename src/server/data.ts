import 'server-only';

import type { ILeadItem } from 'src/types/lead';
import type { ISourceItem } from 'src/types/source';
import type { IConversationItem, IConversationDetails } from 'src/types/conversation';
import type { IBotSummary, IBotNavItem, IBotTabCounts, IUnansweredOutcome } from 'src/types/bot';

import { eq, ne, and, gte, sql, sum, asc, desc, count, inArray } from 'drizzle-orm';

import { getDb, queryRows } from './db';
import { registry } from './ai/registry';
import { bots, leads, chunks, sources, messages, usageEvents, conversations } from './db/schema';

// ----------------------------------------------------------------------

/**
 * Read models for the dashboard. Every function takes ids the caller has already authorised
 * (see src/auth/guard), so none of them re-checks tenancy.
 */

const DAY_MS = 86_400_000;
/** Window of the activity figures on bot cards and the bot overview. */
const ANALYTICS_WINDOW_DAYS = 30;
/** The overview chart shows at most this many days, one bar each. */
const CHART_MAX_DAYS = 14;
const TOP_QUESTIONS_LIMIT = 8;
const UNANSWERED_QUESTIONS_LIMIT = 8;
const CONVERSATION_LIST_LIMIT = 100;
const LEAD_LIST_LIMIT = 500;

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

// ----------------------------------------------------------------------

export async function findWorkspaceBot(botId: string, workspaceId: string) {
  const db = await getDb();
  const [bot] = await db
    .select()
    .from(bots)
    .where(and(eq(bots.id, botId), eq(bots.workspaceId, workspaceId)));
  return bot;
}

export async function listBotNavItems(workspaceId: string): Promise<IBotNavItem[]> {
  const db = await getDb();
  return db
    .select({ id: bots.id, name: bots.name, brandColor: bots.brandColor })
    .from(bots)
    .where(eq(bots.workspaceId, workspaceId))
    .orderBy(desc(bots.createdAt));
}

export async function listBotsWithStats(workspaceId: string): Promise<IBotSummary[]> {
  const db = await getDb();
  const workspaceBots = await db
    .select()
    .from(bots)
    .where(eq(bots.workspaceId, workspaceId))
    .orderBy(desc(bots.createdAt));
  if (!workspaceBots.length) return [];

  const botIds = workspaceBots.map((bot) => bot.id);
  const since = daysAgo(ANALYTICS_WINDOW_DAYS);
  // One grouped query per figure for all bots at once, rather than one query per bot.
  const [conversationCounts, leadCounts, sourceCounts, costs] = await Promise.all([
    db
      .select({ botId: conversations.botId, total: count() })
      .from(conversations)
      .where(and(inArray(conversations.botId, botIds), gte(conversations.createdAt, since)))
      .groupBy(conversations.botId),
    db
      .select({ botId: leads.botId, total: count() })
      .from(leads)
      .where(inArray(leads.botId, botIds))
      .groupBy(leads.botId),
    db
      .select({ botId: sources.botId, total: count(), chunks: sum(sources.chunkCount) })
      .from(sources)
      .where(inArray(sources.botId, botIds))
      .groupBy(sources.botId),
    db
      .select({ botId: usageEvents.botId, usd: sum(usageEvents.costUsd) })
      .from(usageEvents)
      .where(and(inArray(usageEvents.botId, botIds), gte(usageEvents.createdAt, since)))
      .groupBy(usageEvents.botId),
  ]);

  const byBotId = <T extends { botId: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.botId, row]));
  const conversationsByBot = byBotId(conversationCounts);
  const leadsByBot = byBotId(leadCounts);
  const sourcesByBot = byBotId(sourceCounts);
  const costByBot = byBotId(costs);

  return workspaceBots.map((bot) => ({
    bot,
    conversations30d: Number(conversationsByBot.get(bot.id)?.total ?? 0),
    leads: Number(leadsByBot.get(bot.id)?.total ?? 0),
    sources: Number(sourcesByBot.get(bot.id)?.total ?? 0),
    chunks: Number(sourcesByBot.get(bot.id)?.chunks ?? 0),
    cost30d: Number(costByBot.get(bot.id)?.usd ?? 0),
  }));
}

// ----------------------------------------------------------------------

export async function countReadySources(botId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ total: count() })
    .from(sources)
    .where(and(eq(sources.botId, botId), eq(sources.status, 'ready')));
  return Number(row?.total ?? 0);
}

export async function getBotTabCounts(botId: string): Promise<IBotTabCounts> {
  const db = await getDb();
  const [[sourceRow], [leadRow], readySources] = await Promise.all([
    db.select({ total: count() }).from(sources).where(eq(sources.botId, botId)),
    db.select({ total: count() }).from(leads).where(eq(leads.botId, botId)),
    countReadySources(botId),
  ]);
  return {
    sources: Number(sourceRow?.total ?? 0),
    leads: Number(leadRow?.total ?? 0),
    readySources,
  };
}

export async function listSources(botId: string): Promise<ISourceItem[]> {
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
    .select({ total: count() })
    .from(chunks)
    .where(and(eq(chunks.botId, botId), ne(chunks.embeddingModel, model)));
  return Number(row?.total ?? 0);
}

// ----------------------------------------------------------------------

export async function listConversations(botId: string): Promise<IConversationItem[]> {
  const db = await getDb();
  return db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      pageOrigin: conversations.pageOrigin,
      messageCount: conversations.messageCount,
      createdAt: conversations.createdAt,
      lastMessageAt: conversations.lastMessageAt,
      firstQuestion: sql<
        string | null
      >`(SELECT content FROM messages m WHERE m.conversation_id = conversations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1)`,
      unansweredCount:
        sql<number>`(SELECT count(*)::int FROM messages m WHERE m.conversation_id = conversations.id AND m.role = 'assistant' AND m.answered = false)`.mapWith(
          Number
        ),
      hasLead: sql<boolean>`EXISTS (SELECT 1 FROM leads l WHERE l.conversation_id = conversations.id)`,
    })
    .from(conversations)
    .where(eq(conversations.botId, botId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(CONVERSATION_LIST_LIMIT);
}

export async function getConversationDetails(
  botId: string,
  conversationId: string
): Promise<IConversationDetails | undefined> {
  const db = await getDb();
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.botId, botId)));
  if (!conversation) return undefined;

  const [conversationMessages, conversationLeads] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(asc(messages.createdAt)),
    db.select().from(leads).where(eq(leads.conversationId, conversation.id)),
  ]);
  return { conversation, messages: conversationMessages, leads: conversationLeads };
}

// ----------------------------------------------------------------------

/** The most recent leads, newest first, for the dashboard table. */
export async function listRecentLeads(botId: string): Promise<ILeadItem[]> {
  const db = await getDb();
  return db
    .select()
    .from(leads)
    .where(eq(leads.botId, botId))
    .orderBy(desc(leads.createdAt))
    .limit(LEAD_LIST_LIMIT);
}

/** Every lead of a bot, newest first, for the CSV export. */
export async function listAllLeads(botId: string): Promise<ILeadItem[]> {
  const db = await getDb();
  return db.select().from(leads).where(eq(leads.botId, botId)).orderBy(desc(leads.createdAt));
}

// ----------------------------------------------------------------------

export async function botAnalytics(botId: string, days = ANALYTICS_WINDOW_DAYS) {
  const db = await getDb();
  const since = daysAgo(days);
  const assistantReplies = and(
    eq(messages.botId, botId),
    eq(messages.role, 'assistant'),
    gte(messages.createdAt, since)
  );

  const [
    conversationCount,
    outcomeRows,
    leadCount,
    usageRows,
    dailyRows,
    topQuestionRows,
    unansweredRows,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(conversations)
      .where(and(eq(conversations.botId, botId), gte(conversations.createdAt, since))),
    db
      .select({ outcome: messages.outcome, total: count() })
      .from(messages)
      .where(assistantReplies)
      .groupBy(messages.outcome),
    db
      .select({ total: count() })
      .from(leads)
      .where(and(eq(leads.botId, botId), gte(leads.createdAt, since))),
    db
      .select({
        kind: usageEvents.kind,
        model: usageEvents.model,
        input: sum(usageEvents.inputTokens),
        output: sum(usageEvents.outputTokens),
        usd: sum(usageEvents.costUsd),
        calls: count(),
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
    // Grouped by a normalised form of the text so "Hours?" and "hours" count as one question.
    queryRows<{ question: string; asked: number; last_asked: string }>(
      db,
      sql`SELECT min(content) AS question, count(*)::int AS asked, max(created_at)::text AS last_asked
          FROM messages WHERE bot_id = ${botId} AND role = 'user' AND created_at >= ${since.toISOString()}
          GROUP BY lower(regexp_replace(trim(content), '[[:punct:][:space:]]+', ' ', 'g'))
          ORDER BY asked DESC, last_asked DESC LIMIT ${TOP_QUESTIONS_LIMIT}`
    ),
    // The user question that preceded each declined assistant reply.
    queryRows<{
      question: string | null;
      outcome: IUnansweredOutcome;
      created_at: string;
      conversation_id: string;
      confidence: number | null;
    }>(
      db,
      sql`SELECT (SELECT u.content FROM messages u WHERE u.conversation_id = a.conversation_id AND u.role = 'user' AND u.created_at <= a.created_at ORDER BY u.created_at DESC LIMIT 1) AS question,
                 a.outcome, a.created_at::text AS created_at, a.conversation_id, a.confidence
          FROM messages a
          WHERE a.bot_id = ${botId} AND a.role = 'assistant' AND a.outcome IN ('low_confidence', 'no_answer') AND a.created_at >= ${since.toISOString()}
          ORDER BY a.created_at DESC LIMIT ${UNANSWERED_QUESTIONS_LIMIT}`
    ),
  ]);

  const outcomes: Record<string, number> = Object.fromEntries(
    outcomeRows.map((row) => [row.outcome ?? 'unknown', Number(row.total)])
  );
  const replies = Object.values(outcomes).reduce((total, value) => total + value, 0);
  const answered = outcomes.answered ?? 0;
  const usage = usageRows.map((row) => ({
    kind: row.kind,
    model: row.model,
    inputTokens: Number(row.input ?? 0),
    outputTokens: Number(row.output ?? 0),
    costUsd: Number(row.usd ?? 0),
    calls: Number(row.calls),
  }));

  return {
    days,
    conversations: Number(conversationCount[0]?.total ?? 0),
    replies,
    answered,
    unanswered: (outcomes.low_confidence ?? 0) + (outcomes.no_answer ?? 0),
    handoffs: outcomes.handoff ?? 0,
    errors: outcomes.error ?? 0,
    answerRate: replies ? answered / replies : null,
    leads: Number(leadCount[0]?.total ?? 0),
    usage,
    totalCost: usage.reduce((total, row) => total + row.costUsd, 0),
    totalTokens: usage.reduce((total, row) => total + row.inputTokens + row.outputTokens, 0),
    series: dailySeries(dailyRows, Math.min(days, CHART_MAX_DAYS)),
    topQuestions: topQuestionRows.map((row) => ({
      question: row.question,
      asked: Number(row.asked),
    })),
    unansweredQuestions: unansweredRows.flatMap((row) =>
      row.question
        ? [
            {
              question: row.question,
              outcome: row.outcome,
              createdAt: row.created_at,
              conversationId: row.conversation_id,
              confidence: row.confidence,
            },
          ]
        : []
    ),
  };
}

/** One entry per day (oldest first), with zero for days without conversations. */
function dailySeries(rows: { day: string; conversations: number }[], days: number) {
  const countByDay = new Map(rows.map((row) => [row.day, Number(row.conversations)]));
  return Array.from({ length: days }, (_, index) => {
    const day = daysAgo(days - 1 - index)
      .toISOString()
      .slice(0, 10);
    return { day, conversations: countByDay.get(day) ?? 0 };
  });
}
