import type { IBotAnalytics } from 'src/types/bot';

import { formatUsd, formatNumber } from 'src/utils/format-number';

import { Card, CardHeader, EmptyState } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  days: number;
  usage: IBotAnalytics['usage'];
};

export function BotUsageTable({ days, usage }: Props) {
  return (
    <Card>
      <CardHeader
        title="Token usage & estimated cost"
        description={`Last ${days} days, by model`}
      />
      {usage.length ? (
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
            {usage.map((row) => (
              <tr key={row.kind + row.model}>
                <td className="px-5 py-2.5">
                  <span className="font-medium text-zinc-800">{row.model}</span>{' '}
                  <span className="text-xs text-zinc-400">{row.kind}</span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(row.calls)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {formatNumber(row.inputTokens)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {/* Embedding calls have no output tokens. */}
                  {row.kind === 'chat' ? formatNumber(row.outputTokens) : '—'}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums">{formatUsd(row.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="No usage yet" />
      )}
      <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-400">
        Estimates from list prices in src/server/ai/models.ts. Gemini embeddings report no usage, so
        their tokens are estimated from text length.
      </p>
    </Card>
  );
}
