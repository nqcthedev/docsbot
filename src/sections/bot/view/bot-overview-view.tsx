import type { IBotAnalytics } from 'src/types/bot';

import { Users, Wallet, Sparkles, CircleHelp, MessageSquare } from 'lucide-react';

import { formatUsd, formatNumber } from 'src/utils/format-number';

import { BotStatTile } from '../bot-stat-tile';
import { BotUsageTable } from '../bot-usage-table';
import { BotTopQuestions } from '../bot-top-questions';
import { BotConversationsChart } from '../bot-conversations-chart';
import { BotUnansweredQuestions } from '../bot-unanswered-questions';
import { BotStaleEmbeddingsAlert } from '../bot-stale-embeddings-alert';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  analytics: IBotAnalytics;
  staleChunks: number;
  embeddingModel: string | undefined;
};

export function BotOverviewView({ botId, analytics, staleChunks, embeddingModel }: Props) {
  const answerRate =
    analytics.answerRate === null ? '—' : `${Math.round(analytics.answerRate * 100)}%`;

  return (
    <div className="space-y-6">
      {staleChunks > 0 ? (
        <BotStaleEmbeddingsAlert
          botId={botId}
          staleChunks={staleChunks}
          embeddingModel={embeddingModel}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <BotStatTile
          icon={<MessageSquare />}
          label="Conversations"
          value={formatNumber(analytics.conversations)}
          caption={`last ${analytics.days} days`}
        />
        <BotStatTile
          icon={<Sparkles />}
          label="Answer rate"
          value={answerRate}
          caption={`${formatNumber(analytics.answered)} of ${formatNumber(analytics.replies)} replies`}
        />
        <BotStatTile
          icon={<CircleHelp />}
          label="Unanswered"
          value={formatNumber(analytics.unanswered)}
          caption="questions your docs don't cover"
        />
        <BotStatTile
          icon={<Users />}
          label="Leads captured"
          value={formatNumber(analytics.leads)}
          caption="emails collected"
        />
        <BotStatTile
          icon={<Wallet />}
          label="Est. AI cost"
          value={formatUsd(analytics.totalCost)}
          caption={`${formatNumber(analytics.totalTokens)} tokens`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <BotConversationsChart series={analytics.series} />
        <BotTopQuestions questions={analytics.topQuestions} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BotUnansweredQuestions botId={botId} questions={analytics.unansweredQuestions} />
        <BotUsageTable days={analytics.days} usage={analytics.usage} />
      </div>
    </div>
  );
}
