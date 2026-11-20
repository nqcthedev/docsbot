import type { IBotSummary } from 'src/types/bot';

import Link from 'next/link';
import { Users, Database, MessageSquare, Bot as BotIcon } from 'lucide-react';

import { paths } from 'src/routes/paths';

import { formatUsd, formatNumber } from 'src/utils/format-number';

import { Card, Badge } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  summary: IBotSummary;
};

export function OverviewBotCard({ summary }: Props) {
  const { bot, conversations30d, leads, sources, chunks, cost30d } = summary;
  const isTrained = chunks > 0;

  return (
    <Link href={paths.dashboard.bot.root(bot.id)} className="group">
      <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-xl text-white"
              style={{ backgroundColor: bot.brandColor }}
            >
              <BotIcon className="size-5" />
            </span>
            <div>
              <p className="font-medium text-zinc-900">{bot.name}</p>
              <p className="text-xs text-zinc-500">{bot.chatModel}</p>
            </div>
          </div>
          {isTrained ? <Badge tone="green">Trained</Badge> : <Badge tone="amber">No content</Badge>}
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
          <BotStat
            icon={<MessageSquare />}
            label="Chats (30d)"
            value={formatNumber(conversations30d)}
          />
          <BotStat icon={<Users />} label="Leads" value={formatNumber(leads)} />
          <BotStat icon={<Database />} label="Sources" value={formatNumber(sources)} />
        </dl>
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          {formatNumber(chunks)} chunks indexed · est. AI cost (30d) {formatUsd(cost30d)}
        </p>
      </Card>
    </Link>
  );
}

// ----------------------------------------------------------------------

type BotStatProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

function BotStat({ icon, label, value }: BotStatProps) {
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
