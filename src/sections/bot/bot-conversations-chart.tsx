import type { IBotAnalytics } from 'src/types/bot';

import { formatMonthDay } from 'src/utils/format-time';

import { BarChart } from 'src/components/chart';
import { Card, CardHeader } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  series: IBotAnalytics['series'];
};

export function BotConversationsChart({ series }: Props) {
  return (
    <Card className="lg:col-span-3">
      <CardHeader
        title="Conversations per day"
        description={`Last ${series.length} days, all channels`}
      />
      <div className="px-5 py-4">
        <BarChart
          title="Conversations per day"
          data={series.map((point) => ({
            label: formatMonthDay(point.day),
            value: point.conversations,
          }))}
        />
      </div>
    </Card>
  );
}
