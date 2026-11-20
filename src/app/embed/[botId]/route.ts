import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { bots } from "@/server/db/schema";
import { frameAncestors, isOriginAllowed } from "@/server/domains";
import { escapeHtml } from "@/shared/markdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "widget" | "playground" | "standalone";

/**
 * The chat UI that runs inside the widget iframe (and the dashboard playground). Served as a
 * tiny static shell + vanilla JS bundle so it loads fast on customers' sites. The browser
 * enforces the bot's allowed domains via the CSP `frame-ancestors` directive.
 */
export async function GET(req: Request, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const url = new URL(req.url);
  const mode: Mode = url.searchParams.get("mode") === "playground" ? "playground" : url.searchParams.get("mode") === "standalone" ? "standalone" : "widget";
  const pageOrigin = url.searchParams.get("origin")?.slice(0, 300) ?? null;

  const db = await getDb();
  const [bot] = /^[0-9a-f-]{36}$/i.test(botId)
    ? await db.select({ id: bots.id, name: bots.name, brandColor: bots.brandColor, welcomeMessage: bots.welcomeMessage, allowedDomains: bots.allowedDomains, workspaceId: bots.workspaceId, leadCaptureEnabled: bots.leadCaptureEnabled }).from(bots).where(eq(bots.id, botId))
    : [];
  if (!bot) return new Response("<!doctype html><title>Not found</title><p>Bot not found.</p>", { status: 404, headers: { "content-type": "text/html" } });

  if (mode === "playground") {
    const user = await getCurrentUser();
    if (!user || user.workspaceId !== bot.workspaceId) return new Response("Forbidden", { status: 403 });
  }

  const blocked = mode === "widget" && pageOrigin && !isOriginAllowed(pageOrigin, bot.allowedDomains);
  const config = {
    botId: bot.id,
    name: bot.name,
    brandColor: bot.brandColor,
    welcomeMessage: bot.welcomeMessage,
    leadCapture: bot.leadCaptureEnabled,
    mode,
    pageOrigin,
    blocked: Boolean(blocked),
  };
  // JSON inside <script type="application/json"> must not be able to close the tag.
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  const ancestors = mode === "widget" ? frameAncestors(bot.allowedDomains) : mode === "playground" ? "frame-ancestors 'self'" : "frame-ancestors 'none'";
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'none'",
    ancestors,
  ].join("; ");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(bot.name)}</title>
<link rel="stylesheet" href="/widget/chat.css">
<style>:root{--brand:${/^#[0-9a-f]{6}$/i.test(bot.brandColor) ? bot.brandColor : "#4f46e5"}}</style>
</head>
<body class="mode-${mode}">
<div id="app"></div>
<script type="application/json" id="docsbot-config">${json}</script>
<script src="/widget/chat.js" defer></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": csp,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}
