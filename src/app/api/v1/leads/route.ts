import { eq, and } from 'drizzle-orm';

import { getDb } from 'src/server/db';
import { logger } from 'src/server/logger';
import { AppError } from 'src/server/errors';
import { clientIp, requestId } from 'src/server/http/request';
import { bots, leads, conversations } from 'src/server/db/schema';
import { fieldErrors, leadRequestSchema } from 'src/server/validation';
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
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const log = logger.child({ route: 'leads', rid: requestId(req.headers) });
  const cors = corsHeaders(req.headers.get('origin'));
  try {
    const parsed = leadRequestSchema.safeParse(await readJson(req, 8_000));
    if (!parsed.success)
      throw new AppError(
        'invalid_request',
        'Please check the form',
        400,
        fieldErrors(parsed.error)
      );
    const input = parsed.data;
    const db = await getDb();
    const limit = await rateLimit(
      new PostgresRateLimitStore(db),
      `lead:ip:${clientIp(req.headers)}`,
      5,
      600_000
    );
    if (!limit.allowed)
      throw new AppError('rate_limited', 'Too many submissions. Please try again later.', 429);

    const [bot] = await db.select().from(bots).where(eq(bots.id, input.botId));
    if (!bot) throw new AppError('not_found', 'Bot not found', 404);
    if (!bot.leadCaptureEnabled)
      throw new AppError('disabled', 'Lead capture is disabled for this bot', 403);
    assertOriginAllowed(req, bot.allowedDomains);

    let conversationId: string | null = null;
    if (input.conversationId) {
      const [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.botId, bot.id)));
      conversationId = conv?.id ?? null;
    }
    const [lead] = await db
      .insert(leads)
      .values({
        botId: bot.id,
        conversationId,
        email: input.email,
        name: input.name || null,
        question: input.question,
      })
      .returning({ id: leads.id });
    log.info('lead captured', { botId: bot.id, leadId: lead!.id });
    return Response.json({ ok: true, id: lead!.id }, { status: 201, headers: cors });
  } catch (err) {
    return jsonError(err, log, cors);
  }
}
