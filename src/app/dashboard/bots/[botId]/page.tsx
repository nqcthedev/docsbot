import { AlertTriangle, CircleHelp, MessageSquare, Sparkles, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { BarChart } from "@/components/bar-chart";
import { Alert, Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { formatNumber, formatUsd, timeAgo } from "@/lib/utils";
import { botAnalytics, requireBot, staleChunkCount } from "@/server/data";
import { registry } from "@/server/ai/registry";
import { resyncAllSources } from "../../actions";

export const metadata = { title: "Overview" };

export default async function BotOverview({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const [a, stale] = await Promise.all([botAnalytics(bot.id), staleChunkCount(bot.id)]);
  const currentModel = registry().embeddings?.model;
  const base = `/dashboard/bots/${bot.id}`;

  return (
    <div className="space-y-6">
      {stale > 0 ? (
        <Alert tone="amber" className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4" />
            {formatNumber(stale)} chunks were embedded with a different model than the configured <code>{currentModel}</code>. They are excluded from search until you re-sync.
          </span>
          <form action={resyncAllSources.bind(null, bot.id)}>
            <Button size="sm" variant="outline">
              Re-sync all sources
            </Button>
          </form>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Tile icon={<MessageSquare />} label="Conversations" value={formatNumber(a.conversations)} sub={`last ${a.days} days`} />
        <Tile icon={<Sparkles />} label="Answer rate" value={a.answerRate === null ? "—" : `${Math.round(a.answerRate * 100)}%`} sub={`${formatNumber(a.answered)} of ${formatNumber(a.replies)} replies`} />
        <Tile icon={<CircleHelp />} label="Unanswered" value={formatNumber(a.unanswered)} sub="questions your docs don't cover" />
        <Tile icon={<Users />} label="Leads captured" value={formatNumber(a.leads)} sub="emails collected" />
        <Tile icon={<Wallet />} label="Est. AI cost" value={formatUsd(a.totalCost)} sub={`${formatNumber(a.totalTokens)} tokens`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Conversations per day" description="Last 14 days, all channels" />
          <div className="px-5 py-4">
            <BarChart data={a.series.map((s) => ({ label: s.day.slice(5).replace("-", "/"), value: s.conversations }))} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Top questions" description="Most frequently asked" />
          {a.topQuestions.length ? (
            <ul className="divide-y divide-zinc-100">
              {a.topQuestions.map((q) => (
                <li key={q.question} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="line-clamp-1 text-zinc-700">{q.question}</span>
                  <Badge>{q.asked}×</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No questions yet">Try the playground or embed the widget.</EmptyState>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Unanswered questions" description="Knowledge gaps: add content that covers these" />
          {a.unansweredQuestions.length ? (
            <ul className="divide-y divide-zinc-100">
              {a.unansweredQuestions.map((q) => (
                <li key={q.conversationId + q.createdAt} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <Link href={`${base}/conversations/${q.conversationId}`} className="line-clamp-1 text-zinc-700 hover:text-brand-700">
                    {q.question}
                  </Link>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {q.outcome === "low_confidence" ? "low match" : "not in docs"} · {timeAgo(q.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing unanswered">Questions the bot declines will show up here.</EmptyState>
          )}
        </Card>
        <Card>
          <CardHeader title="Token usage & estimated cost" description={`Last ${a.days} days, by model`} />
          {a.usage.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Model</th>
                  <th className="px-2 py-2 text-right font-medium">Calls</th>
                  <th className="px-2 py-2 text-right font-medium">Input</th>
                  <th className="px-2 py-2 text-right font-medium">Output</th>
                  <th className="px-5 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {a.usage.map((u) => (
                  <tr key={u.kind + u.model}>
                    <td className="px-5 py-2.5">
                      <span className="font-medium text-zinc-800">{u.model}</span> <span className="text-xs text-zinc-400">{u.kind}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(u.calls)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(u.inputTokens)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{u.kind === "chat" ? formatNumber(u.outputTokens) : "—"}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{formatUsd(u.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="No usage yet" />
          )}
          <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-400">Estimates from list prices in src/server/ai/models.ts. Gemini embeddings report no usage, so their tokens are estimated from text length.</p>
        </Card>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-400">{sub}</div>
    </Card>
  );
}
