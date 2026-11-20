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
import {
  readJson,
  jsonError,
  preflight,
  corsHeaders,
  assertOriginAllowed,
} from 'src/server/http/public-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const OPTIONS = preflight;

/**
 * Public chat endpoint used by the widget (and usable directly). Streams Server-Sent Events:
 *   meta  → { conversationId }
 *   start → { provider, model }
 *   token → { text }               (repeated)
 *   done  → { messageId, answered, outcome, citations, offerLead, replaceWith? }
 */
export async function POST(req: Request) {
  const rid = requestId(req.headers);
  const log = logger.child({ route: 'chat', rid });
  const cors = corsHeaders(req.headers.get('origin'));
  try {
    const e = env();
    const parsed = chatRequestSchema.safeParse(await readJson(req, 32_000));
    if (!parsed.success)
      throw new AppError(
        'invalid_request',
        'Invalid request',
        400,
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      );
    const input = parsed.data;
    if (input.message.length > e.MAX_MESSAGE_CHARS)
      throw new AppError(
        'message_too_long',
        `Messages are limited to ${e.MAX_MESSAGE_CHARS} characters`,
        413
      );

    const db = await getDb();
    const store = new PostgresRateLimitStore(db);
    const ip = clientIp(req.headers);
    const ipLimit = await rateLimit(
      store,
      `chat:ip:${ip}`,
      e.RATE_LIMIT_CHAT_PER_IP_PER_MINUTE,
      60_000
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
      e.RATE_LIMIT_CHAT_PER_BOT_PER_HOUR,
      3_600_000
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
          pageOrigin: input.pageOrigin?.slice(0, 300) ?? null,
        })
        .returning({ id: conversations.id });
      conversationId = created!.id;
    }

    const history = (
      await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(8)
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
            emit: (ev) => send(ev.type, ev),
            logger: log,
            signal: req.signal,
            fallbackOptions: { maxRetries: e.AI_MAX_RETRIES },
          });
        } catch (err) {
          log.error('chat stream failed', { err });
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
  } catch (err) {
    return jsonError(err, log, cors);
  }
}
