import type { IBotAnalytics, IUnansweredOutcome } from 'src/types/bot';

import Link from 'next/link';

import { paths } from 'src/routes/paths';

import { formatTimeAgo } from 'src/utils/format-time';

import { Card, CardHeader, EmptyState } from 'src/components/ui';

// ----------------------------------------------------------------------

function outcomeLabel(outcome: IUnansweredOutcome) {
  switch (outcome) {
    case 'low_confidence':
      return 'low match';
    case 'no_answer':
      return 'not in docs';
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  questions: IBotAnalytics['unansweredQuestions'];
};

export function BotUnansweredQuestions({ botId, questions }: Props) {
  return (
    <Card>
      <CardHeader
        title="Unanswered questions"
        description="Knowledge gaps: add content that covers these"
      />
      {questions.length ? (
        <ul className="divide-y divide-zinc-100">
          {questions.map((item) => (
            <li
              key={item.conversationId + item.createdAt}
              className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
            >
              <Link
                href={paths.dashboard.bot.conversation(botId, item.conversationId)}
                className="line-clamp-1 text-zinc-700 hover:text-brand-700"
              >
                {item.question}
              </Link>
              <span className="shrink-0 text-xs text-zinc-400">
                {outcomeLabel(item.outcome)} · {formatTimeAgo(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing unanswered">
          Questions the bot declines will show up here.
        </EmptyState>
      )}
    </Card>
  );
}
