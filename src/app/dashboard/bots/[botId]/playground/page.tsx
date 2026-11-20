import { and, count, eq } from "drizzle-orm";
import { Alert, Card, CardHeader } from "@/components/ui";
import { requireBot } from "@/server/data";
import { getDb } from "@/server/db";
import { sources } from "@/server/db/schema";

export const metadata = { title: "Playground" };

export default async function PlaygroundPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const db = await getDb();
  const [ready] = await db.select({ n: count() }).from(sources).where(and(eq(sources.botId, bot.id), eq(sources.status, "ready")));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title="Test your bot" description="This is the exact chat your visitors get, rendered from the embeddable widget." />
          <div className="space-y-3 px-5 py-4 text-sm text-zinc-600">
            <p>Ask questions your customers would ask. Answers are grounded in your sources and cite them; click a citation to open the page it came from.</p>
            <p>
              If the best match scores below the confidence threshold (<b>{bot.minSimilarity.toFixed(2)}</b>), the bot declines instead of guessing and offers to collect the visitor&apos;s email.
            </p>
            <p className="text-xs text-zinc-400">Playground chats are logged with the channel &quot;playground&quot; and count toward usage.</p>
          </div>
        </Card>
        {Number(ready?.n ?? 0) === 0 ? <Alert>This bot has no ready sources yet, so it can&apos;t answer anything. Add a source first.</Alert> : null}
      </div>
      <Card className="overflow-hidden lg:col-span-3">
        <iframe src={`/embed/${bot.id}?mode=playground`} title={`${bot.name} playground`} className="h-[640px] w-full border-0" data-testid="playground-frame" />
      </Card>
    </div>
  );
}
