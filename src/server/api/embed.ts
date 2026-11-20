import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { getDb } from 'src/server/db';
import { bots } from 'src/server/db/schema';
import { escapeHtml } from 'src/shared/markdown';
import { entityIdSchema } from 'src/server/validation';
import { getCurrentUser } from 'src/server/auth/session';
import { frameAncestors, isOriginAllowed } from 'src/server/domains';

// ----------------------------------------------------------------------

const EMBED_MODES = ['widget', 'playground', 'standalone'] as const;

type EmbedMode = (typeof EMBED_MODES)[number];

/** Unknown or missing modes fall back to the customer-site widget, the most restrictive one. */
const embedModeSchema = z.enum(EMBED_MODES).catch('widget');

const PAGE_ORIGIN_MAX_LENGTH = 300;
const DEFAULT_BRAND_COLOR = '#4f46e5';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type Context = {
  params: Promise<{ botId: string }>;
};

/** Who may frame the chat: customer sites on the allow-list, our dashboard, or nobody. */
function frameAncestorsFor(mode: EmbedMode, allowedDomains: string[]) {
  switch (mode) {
    case 'widget':
      return frameAncestors(allowedDomains);
    case 'playground':
      return "frame-ancestors 'self'";
    case 'standalone':
      return "frame-ancestors 'none'";
    default: {
      const unhandled: never = mode;
      return unhandled;
    }
  }
}

// ----------------------------------------------------------------------

/**
 * The chat UI that runs inside the widget iframe (and the dashboard playground). Served as a
 * tiny static shell + vanilla JS bundle so it loads fast on customers' sites. The browser
 * enforces the bot's allowed domains via the CSP `frame-ancestors` directive.
 */
export async function handleEmbedRequest(req: Request, { params }: Context) {
  const { botId } = await params;
  const url = new URL(req.url);
  const mode = embedModeSchema.parse(url.searchParams.get('mode'));
  const pageOrigin = url.searchParams.get('origin')?.slice(0, PAGE_ORIGIN_MAX_LENGTH) ?? null;

  const db = await getDb();
  const [bot] = entityIdSchema.safeParse(botId).success
    ? await db
        .select({
          id: bots.id,
          name: bots.name,
          brandColor: bots.brandColor,
          welcomeMessage: bots.welcomeMessage,
          allowedDomains: bots.allowedDomains,
          workspaceId: bots.workspaceId,
          leadCaptureEnabled: bots.leadCaptureEnabled,
        })
        .from(bots)
        .where(eq(bots.id, botId))
    : [];
  if (!bot)
    return new Response('<!doctype html><title>Not found</title><p>Bot not found.</p>', {
      status: 404,
      headers: { 'content-type': 'text/html' },
    });

  if (mode === 'playground') {
    const user = await getCurrentUser();
    if (!user || user.workspaceId !== bot.workspaceId)
      return new Response('Forbidden', { status: 403 });
  }

  // The embedding page reports its origin; an empty or missing one cannot be checked here
  // (the CSP frame-ancestors header still applies).
  const isBlocked =
    mode === 'widget' && pageOrigin ? !isOriginAllowed(pageOrigin, bot.allowedDomains) : false;
  const config = {
    botId: bot.id,
    name: bot.name,
    brandColor: bot.brandColor,
    welcomeMessage: bot.welcomeMessage,
    leadCapture: bot.leadCaptureEnabled,
    mode,
    pageOrigin,
    blocked: isBlocked,
  };
  // JSON inside <script type="application/json"> must not be able to close the tag.
  const json = JSON.stringify(config).replace(/</g, '\\u003c');
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    frameAncestorsFor(mode, bot.allowedDomains),
  ].join('; ');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(bot.name)}</title>
<link rel="stylesheet" href="/widget/chat.css">
<style>:root{--brand:${HEX_COLOR.test(bot.brandColor) ? bot.brandColor : DEFAULT_BRAND_COLOR}}</style>
</head>
<body class="mode-${mode}">
<div id="app"></div>
<script type="application/json" id="docsbot-config">${json}</script>
<script src="/widget/chat.js" defer></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': csp,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  });
}
