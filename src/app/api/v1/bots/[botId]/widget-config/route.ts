import { eq } from 'drizzle-orm';

import { getDb } from 'src/server/db';
import { bots } from 'src/server/db/schema';
import { isOriginAllowed } from 'src/server/domains';
import { preflight, corsHeaders } from 'src/server/http/public-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = preflight;

/** Public, read-only widget appearance. Refuses origins that are not on the bot's allow-list. */
export async function GET(req: Request, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);
  if (!/^[0-9a-f-]{36}$/i.test(botId))
    return Response.json({ error: { code: 'not_found' } }, { status: 404, headers: cors });
  const db = await getDb();
  const [bot] = await db
    .select({
      id: bots.id,
      name: bots.name,
      brandColor: bots.brandColor,
      welcomeMessage: bots.welcomeMessage,
      allowedDomains: bots.allowedDomains,
    })
    .from(bots)
    .where(eq(bots.id, botId));
  if (!bot)
    return Response.json(
      { error: { code: 'not_found', message: 'Bot not found' } },
      { status: 404, headers: cors }
    );
  if (origin && !isOriginAllowed(origin, bot.allowedDomains)) {
    return Response.json(
      {
        error: {
          code: 'domain_not_allowed',
          message: `This bot is not enabled for ${origin}. Add the domain under Settings → Allowed domains.`,
        },
      },
      { status: 403, headers: cors }
    );
  }
  return Response.json(
    { id: bot.id, name: bot.name, brandColor: bot.brandColor, welcomeMessage: bot.welcomeMessage },
    { headers: { ...cors, 'cache-control': 'public, max-age=60' } }
  );
}
