import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { cn, formatDateTime } from "@/lib/utils";
import { requireBot } from "@/server/data";
import { getDb } from "@/server/db";
import { conversations, leads, messages } from "@/server/db/schema";
import { citationLabel, renderMarkdown } from "@/shared/markdown";

export const metadata = { title: "Conversation" };

const outcomeLabel: Record<string, string> = {
  low_confidence: "Declined: low retrieval confidence",
  no_answer: "Declined: not in sources",
  handoff: "Human handoff requested",
  error: "Provider error",
  not_indexed: "Bot not trained",
};

export default async function ConversationPage({ params }: { params: Promise<{ botId: string; conversationId: string }> }) {
  const { botId, conversationId } = await params;
  const { bot } = await requireBot(botId);
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) notFound();
  const db = await getDb();
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.botId, bot.id)));
  if (!conv) notFound();
  const [msgs, lead] = await Promise.all([
    db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(asc(messages.createdAt)),
    db.select().from(leads).where(eq(leads.conversationId, conv.id)),
  ]);

  return (
    <div className="space-y-4">
      <Link href={`/dashboard/bots/${bot.id}/conversations`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="size-4" /> All conversations
      </Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-5 lg:col-span-2">
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-800")}>
                {m.role === "assistant" ? <div className="answer" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content, m.citations) }} /> : <p className="whitespace-pre-wrap">{m.content}</p>}
                {m.role === "assistant" && m.citations.length ? (
                  <ol className="mt-2 space-y-0.5 border-t border-zinc-200 pt-2 text-xs text-zinc-500">
                    {m.citations.map((c) => (
                      <li key={c.n}>
                        [{c.n}]{" "}
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="underline hover:text-zinc-800">
                            {citationLabel(c)}
                          </a>
                        ) : (
                          citationLabel(c)
                        )}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {m.role === "assistant" ? (
                  <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-zinc-400">
                    {m.outcome && m.outcome !== "answered" ? <span className="text-amber-700">{outcomeLabel[m.outcome] ?? m.outcome}</span> : null}
                    {m.confidence !== null ? <span>similarity {m.confidence.toFixed(2)}</span> : null}
                    {m.model ? <span>{m.model}</span> : null}
                    {m.inputTokens ? <span>{m.inputTokens + (m.outputTokens ?? 0)} tokens</span> : null}
                    {m.latencyMs ? <span>{(m.latencyMs / 1000).toFixed(1)}s</span> : null}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
        <Card className="h-fit space-y-3 p-5 text-sm">
          <h3 className="font-semibold">Details</h3>
          <dl className="space-y-2 text-zinc-600">
            <div className="flex justify-between">
              <dt>Channel</dt>
              <dd>
                <Badge>{conv.channel}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Page</dt>
              <dd className="truncate">{conv.pageOrigin ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Started</dt>
              <dd>{formatDateTime(conv.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Messages</dt>
              <dd>{conv.messageCount}</dd>
            </div>
          </dl>
          {lead.map((l) => (
            <div key={l.id} className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-brand-800">
              <p className="font-medium">Lead captured</p>
              <p className="mt-1">{l.email}</p>
              <p className="mt-1 text-xs">“{l.question}”</p>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
