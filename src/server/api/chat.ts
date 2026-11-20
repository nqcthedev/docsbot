import { eq, and, sql, desc } from 'drizzle-orm';

import { env } from 'src/server/env';
import { getDb } from 'src/server/db';
import { logger } from 'src/server/logger';
import { encodeSse } from 'src/shared/sse';
import { AppError } from 'src/server/errors';
import { registry } from 'src/server/ai/registry';
import { answerQuestion } from 'src/server/rag/answer';
import { getCurrentUser } from 'src/server/auth/session';
import { chatRequestSchema } from 'src/server/validation';
import { clientIp, requestId } from 'src/server/http/request';
import { bots, messages, conversations } from 'src/server/db/schema';
import { rateLimit, PostgresRateLimitStore } from 'src/server/ratelimit';
import { readJson, jsonError, corsHeaders, assertOriginAllowed } from 'src/server/http/public-api';

// ----------------------------------------------------------------------

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** Upper bound of the JSON body; the message itself is limited by MAX_MESSAGE_CHARS. */
const MAX_BODY_BYTES = 32_000;
/** Earlier turns sent to the model so follow-up questions make sense. */
const HISTORY_MESSAGES = 8;
const PAGE_ORIGIN_MAX_LENGTH = 300;

// ----------------------------------------------------------------------

/**
 * Public chat endpoint used by the widget (and usable directly). Streams Server-Sent Events:
 *   meta  → { conversationId }
 *   start → { provider, model }
 *   token → { text }               (repeated)
 *   done  → { messageId, answered, outcome, citations, offerLead, replaceWith? }
 */
export async function handleChatRequest(req: Request) {
  const rid = requestId(req.headers);
  const log = logger.child({ route: 'chat', rid });
  const cors = corsHeaders(req.headers.get('origin'));
  try {
    const config = env();
    const parsed = chatRequestSchema.safeParse(await readJson(req, MAX_BODY_BYTES));
    if (!parsed.success)
      throw new AppError(
        'invalid_request',
        'Invalid request',
        400,
        parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      );
    const input = parsed.data;
    if (input.message.length > config.MAX_MESSAGE_CHARS)
      throw new AppError(
        'message_too_long',
        `Messages are limited to ${config.MAX_MESSAGE_CHARS} characters`,
        413
      );

    const db = await getDb();
    const store = new PostgresRateLimitStore(db);
    const ip = clientIp(req.headers);
    const ipLimit = await rateLimit(
      store,
      `chat:ip:${ip}`,
      config.RATE_LIMIT_CHAT_PER_IP_PER_MINUTE,
      MINUTE_MS
    );
    if (!ipLimit.allowed) {
      return Response.json(
        { error: { code: 'rate_limited', message: 'Too many messages. Please wait a moment.' } },
        { status: 429, headers: { ...cors, 'retry-after': String(ipLimit.retryAfterSeconds) } }
      );
    }

    const [bot] = await db.select().from(bots).where(eq(bots.id, input.botId));
    if (!bot) throw new AppError('not_found', 'Bot not found', 404);
    assertOriginAllowed(
      req,
      bot.allowedDomains,
      input.channel === 'widget' ? input.pageOrigin : undefined
    );

    if (input.channel === 'playground') {
      const user = await getCurrentUser();
      if (!user || user.workspaceId !== bot.workspaceId)
        throw new AppError(
          'forbidden',
          'Playground requires being signed in as the bot owner',
          403
        );
    }

    const botLimit = await rateLimit(
      store,
      `chat:bot:${bot.id}`,
      config.RATE_LIMIT_CHAT_PER_BOT_PER_HOUR,
      HOUR_MS
    );
    if (!botLimit.allowed) {
      log.warn('bot rate limit hit', { botId: bot.id });
      return Response.json(
        {
          error: {
            code: 'rate_limited',
            message:
              'This assistant is receiving too many messages right now. Please try again later.',
          },
        },
        { status: 429, headers: { ...cors, 'retry-after': String(botLimit.retryAfterSeconds) } }
      );
    }

    let conversationId = input.conversationId;
    if (conversationId) {
      const [existing] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.botId, bot.id),
            eq(conversations.visitorId, input.visitorId)
          )
        );
      if (!existing) conversationId = undefined;
    }
    if (!conversationId) {
      const [created] = await db
        .insert(conversations)
        .values({
          botId: bot.id,
          visitorId: input.visitorId,
          channel: input.channel,
          pageOrigin: input.pageOrigin?.slice(0, PAGE_ORIGIN_MAX_LENGTH) ?? null,
        })
        .returning({ id: conversations.id });
      if (!created) throw new AppError('internal_error', 'Could not start a conversation', 500);
      conversationId = created.id;
    }

    const history = (
      await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(HISTORY_MESSAGES)
    ).reverse();

    await db
      .insert(messages)
      .values({ conversationId, botId: bot.id, role: 'user', content: input.message });
    await db
      .update(conversations)
      .set({ messageCount: sql`${conversations.messageCount} + 1`, lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const convId = conversationId;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let open = true;
        const send = (event: string, data: unknown) => {
          if (!open) return;
          try {
            controller.enqueue(encoder.encode(encodeSse(event, data)));
          } catch {
            open = false; // client disconnected
          }
        };
        send('meta', { conversationId: convId });
        try {
          await answerQuestion({
            db,
            registry: registry(),
            bot,
            conversationId: convId,
            question: input.message,
            history,
            emit: (event) => send(event.type, event),
            logger: log,
            signal: req.signal,
            fallbackOptions: { maxRetries: config.AI_MAX_RETRIES },
          });
        } catch (error) {
          log.error('chat stream failed', { err: error });
          send('error', { message: 'Something went wrong. Please try again.' });
        } finally {
          open = false;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...cors,
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'x-accel-buffering': 'no',
        'x-request-id': rid,
        'x-ratelimit-remaining': String(ipLimit.remaining),
      },
    });
  } catch (error) {
    return jsonError(error, log, cors);
  }
}
