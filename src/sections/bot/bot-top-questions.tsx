import type { IBotAnalytics } from 'src/types/bot';

import { Card, Badge, CardHeader, EmptyState } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  questions: IBotAnalytics['topQuestions'];
};

export function BotTopQuestions({ questions }: Props) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Top questions" description="Most frequently asked" />
      {questions.length ? (
        <ul className="divide-y divide-zinc-100">
          {questions.map((item) => (
            <li
              key={item.question}
              className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
            >
              <span className="line-clamp-1 text-zinc-700">{item.question}</span>
              <Badge>{item.asked}×</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No questions yet">Try the playground or embed the widget.</EmptyState>
      )}
    </Card>
  );
}
