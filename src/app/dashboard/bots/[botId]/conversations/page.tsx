import { desc, eq, sql } from "drizzle-orm";
import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { requireBot } from "@/server/data";
import { getDb } from "@/server/db";
import { conversations } from "@/server/db/schema";

export const metadata = { title: "Conversations" };

export default async function ConversationsPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const db = await getDb();
  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      pageOrigin: conversations.pageOrigin,
      messageCount: conversations.messageCount,
      createdAt: conversations.createdAt,
      lastMessageAt: conversations.lastMessageAt,
      firstQuestion: sql<string | null>`(SELECT content FROM messages m WHERE m.conversation_id = conversations.id AND m.role = 'user' ORDER BY m.created_at ASC LIMIT 1)`,
      unanswered: sql<number>`(SELECT count(*)::int FROM messages m WHERE m.conversation_id = conversations.id AND m.role = 'assistant' AND m.answered = false)`,
      hasLead: sql<boolean>`EXISTS (SELECT 1 FROM leads l WHERE l.conversation_id = conversations.id)`,
    })
    .from(conversations)
    .where(eq(conversations.botId, bot.id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  if (!rows.length)
    return (
      <Card>
        <EmptyState icon={<MessagesSquare />} title="No conversations yet">
          Conversations from the widget and the playground appear here.
        </EmptyState>
      </Card>
    );

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs text-zinc-500">
          <tr>
            <th className="px-5 py-2.5 font-medium">First question</th>
            <th className="px-3 py-2.5 font-medium">Channel</th>
            <th className="px-3 py-2.5 text-right font-medium">Messages</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-5 py-2.5 text-right font-medium">Last activity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-zinc-50">
              <td className="max-w-md px-5 py-3">
                <Link href={`/dashboard/bots/${bot.id}/conversations/${c.id}`} className="line-clamp-1 font-medium text-zinc-800 hover:text-brand-700">
                  {c.firstQuestion ?? "(no messages)"}
                </Link>
                {c.pageOrigin ? <p className="text-xs text-zinc-400">{c.pageOrigin}</p> : null}
              </td>
              <td className="px-3 py-3">
                <Badge tone={c.channel === "widget" ? "blue" : "neutral"}>{c.channel}</Badge>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{c.messageCount}</td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  {Number(c.unanswered) > 0 ? <Badge tone="amber">{c.unanswered} unanswered</Badge> : <Badge tone="green">answered</Badge>}
                  {c.hasLead ? <Badge tone="blue">lead</Badge> : null}
                </div>
              </td>
              <td className="px-5 py-3 text-right text-zinc-500">{formatDateTime(c.lastMessageAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
