import { Bot as BotIcon, Database, MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatNumber, formatUsd } from "@/lib/utils";
import { listBotsWithStats, requireUser } from "@/server/data";
import { CreateBotForm } from "./create-bot-form";

export const metadata = { title: "Bots" };

export default async function DashboardHome() {
  const user = await requireUser();
  const list = await listBotsWithStats(user.workspaceId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your bots</h1>
          <p className="mt-1 text-sm text-zinc-500">Each bot has its own knowledge sources, settings, widget and analytics.</p>
        </div>
        <CreateBotForm />
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<BotIcon />} title="No bots yet">
            Create a bot, point it at your website or upload a PDF, and embed it with one line of HTML.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ bot, conversations30d, leads, sources, chunks, cost30d }) => (
            <Link key={bot.id} href={`/dashboard/bots/${bot.id}`} className="group">
              <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl text-white" style={{ backgroundColor: bot.brandColor }}>
                      <BotIcon className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium text-zinc-900">{bot.name}</p>
                      <p className="text-xs text-zinc-500">{bot.chatModel}</p>
                    </div>
                  </div>
                  {chunks > 0 ? <Badge tone="green">Trained</Badge> : <Badge tone="amber">No content</Badge>}
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <Stat icon={<MessageSquare />} label="Chats (30d)" value={formatNumber(conversations30d)} />
                  <Stat icon={<Users />} label="Leads" value={formatNumber(leads)} />
                  <Stat icon={<Database />} label="Sources" value={formatNumber(sources)} />
                </dl>
                <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  {formatNumber(chunks)} chunks indexed · est. AI cost (30d) {formatUsd(cost30d)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-zinc-500 [&_svg]:size-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-zinc-900">{value}</dd>
    </div>
  );
}
