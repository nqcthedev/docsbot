import type { IBotSummary } from 'src/types/bot';

import { Bot as BotIcon } from 'lucide-react';

import { Card, EmptyState } from 'src/components/ui';

import { OverviewBotCard } from '../overview-bot-card';
import { OverviewCreateBotForm } from '../overview-create-bot-form';

// ----------------------------------------------------------------------

type Props = {
  bots: IBotSummary[];
};

export function OverviewBotsView({ bots }: Props) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your bots</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Each bot has its own knowledge sources, settings, widget and analytics.
          </p>
        </div>
        <OverviewCreateBotForm />
      </div>

      {bots.length === 0 ? (
        <Card>
          <EmptyState icon={<BotIcon />} title="No bots yet">
            Create a bot, point it at your website or upload a PDF, and embed it with one line of
            HTML.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((summary) => (
            <OverviewBotCard key={summary.bot.id} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
}
