import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { bots, conversations, leads } from "@/server/db/schema";
import { AppError } from "@/server/errors";
import { assertOriginAllowed, corsHeaders, jsonError, preflight, readJson } from "@/server/http/public-api";
import { clientIp, requestId } from "@/server/http/request";
import { logger } from "@/server/logger";
import { PostgresRateLimitStore, rateLimit } from "@/server/ratelimit";
import { fieldErrors, leadRequestSchema } from "@/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: Request) {
  const log = logger.child({ route: "leads", rid: requestId(req.headers) });
  const cors = corsHeaders(req.headers.get("origin"));
  try {
    const parsed = leadRequestSchema.safeParse(await readJson(req, 8_000));
    if (!parsed.success) throw new AppError("invalid_request", "Please check the form", 400, fieldErrors(parsed.error));
    const input = parsed.data;
    const db = await getDb();
    const limit = await rateLimit(new PostgresRateLimitStore(db), `lead:ip:${clientIp(req.headers)}`, 5, 600_000);
    if (!limit.allowed) throw new AppError("rate_limited", "Too many submissions. Please try again later.", 429);

    const [bot] = await db.select().from(bots).where(eq(bots.id, input.botId));
    if (!bot) throw new AppError("not_found", "Bot not found", 404);
    if (!bot.leadCaptureEnabled) throw new AppError("disabled", "Lead capture is disabled for this bot", 403);
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
      .values({ botId: bot.id, conversationId, email: input.email, name: input.name || null, question: input.question })
      .returning({ id: leads.id });
    log.info("lead captured", { botId: bot.id, leadId: lead!.id });
    return Response.json({ ok: true, id: lead!.id }, { status: 201, headers: cors });
  } catch (err) {
    return jsonError(err, log, cors);
  }
}
