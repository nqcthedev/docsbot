import Link from "next/link";
import { Alert, Card, CardHeader } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { requireBot } from "@/server/data";
import { env } from "@/server/env";

export const metadata = { title: "Install" };

export default async function InstallPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const appUrl = env().APP_URL.replace(/\/$/, "");
  const snippet = `<script src="${appUrl}/widget.js" data-bot-id="${bot.id}" async></script>`;
  const api = `curl -N ${appUrl}/api/v1/chat \\
  -H 'content-type: application/json' \\
  -d '{"botId":"${bot.id}","visitorId":"visitor-123456","message":"Do you ship to Canada?"}'`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Embed the chat widget" description="Paste this before </body> on every page where the chat bubble should appear." />
        <div className="space-y-4 p-5">
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 pr-24 font-mono text-[13px] text-zinc-100" data-testid="embed-snippet">{snippet}</pre>
            <CopyButton text={snippet} className="absolute right-3 top-3" />
          </div>
          {bot.allowedDomains.length === 0 ? (
            <Alert>
              No allowed domains are set, so any website can embed this bot (and use your AI credits). <Link href={`/dashboard/bots/${bot.id}/settings`} className="font-medium underline">Restrict it in Settings</Link>.
            </Alert>
          ) : (
            <Alert tone="green">
              The widget only loads on: <b>{bot.allowedDomains.join(", ")}</b>. Browsers enforce this with a <code>frame-ancestors</code> Content-Security-Policy on the chat iframe.
            </Alert>
          )}
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
            <li>The loader is about 2 KB gzipped, loads asynchronously and renders inside a Shadow DOM + iframe, so it can&apos;t clash with your site&apos;s CSS.</li>
            <li>Works with any stack: plain HTML, WordPress, Shopify, Webflow, Next.js, etc.</li>
            <li>
              Shareable full-page chat:{" "}
              <a className="text-brand-600 underline" href={`/embed/${bot.id}?mode=standalone`} target="_blank" rel="noreferrer">
                {appUrl}/embed/{bot.id}?mode=standalone
              </a>
            </li>
          </ul>
        </div>
      </Card>
      <Card>
        <CardHeader title="HTTP API" description="Server-Sent Events stream: start → token… → done (with citations and lead-capture hint)." />
        <div className="relative p-5">
          <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 pr-24 font-mono text-[13px] text-zinc-100">{api}</pre>
          <CopyButton text={api} className="absolute right-8 top-8" />
        </div>
      </Card>
    </div>
  );
}
