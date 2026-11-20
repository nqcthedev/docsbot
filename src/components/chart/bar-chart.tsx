import { barChartTicks } from './utils';

// ----------------------------------------------------------------------

/** Drawing units of the SVG viewBox; the chart scales to its container width. */
const PLOT_WIDTH = 600;
const AXIS_WIDTH = 28;
const BAR_GAP = 6;
const TOP_PADDING = 10;
const LABEL_HEIGHT = 22;
/** With more bars than this, only every other x-axis label is drawn so they don't overlap. */
const MAX_LABELED_BARS = 8;

export type BarChartDatum = {
  label: string;
  value: number;
};

// ----------------------------------------------------------------------

type Props = {
  data: BarChartDatum[];
  /** Accessible name of the chart. */
  title: string;
  color?: string;
  height?: number;
};

/** Accessible SVG bar chart, rendered on the server (no client JavaScript). */
export function BarChart({ data, title, color = 'var(--color-brand-500)', height = 140 }: Props) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const barWidth = (PLOT_WIDTH - BAR_GAP * (data.length - 1)) / data.length;
  const plotHeight = height - LABEL_HEIGHT - TOP_PADDING;
  const yFor = (value: number) => TOP_PADDING + plotHeight - (value / max) * plotHeight;

  return (
    <svg
      viewBox={`0 0 ${PLOT_WIDTH + AXIS_WIDTH} ${height}`}
      className="w-full"
      role="img"
      aria-label={title}
    >
      {barChartTicks(max).map((tick) => (
        <g key={tick}>
          <line
            x1={AXIS_WIDTH}
            x2={PLOT_WIDTH + AXIS_WIDTH}
            y1={yFor(tick)}
            y2={yFor(tick)}
            stroke="#e4e4e7"
            strokeDasharray={tick === 0 ? undefined : '3 3'}
          />
          <text x={20} y={yFor(tick) + 4} textAnchor="end" fontSize="10" fill="#a1a1aa">
            {tick}
          </text>
        </g>
      ))}
      {data.map((datum, index) => {
        const barHeight = (datum.value / max) * plotHeight;
        const x = AXIS_WIDTH + index * (barWidth + BAR_GAP);
        const isLabeled = index % 2 === 0 || data.length <= MAX_LABELED_BARS;
        return (
          <g key={datum.label}>
            <title>{`${datum.label}: ${datum.value}`}</title>
            <rect
              x={x}
              y={TOP_PADDING + plotHeight - barHeight}
              width={barWidth}
              // Non-zero values get a visible sliver even when tiny relative to the maximum.
              height={Math.max(barHeight, datum.value ? 2 : 0)}
              rx={3}
              fill={color}
            />
            {isLabeled ? (
              <text
                x={x + barWidth / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill="#71717a"
              >
                {datum.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
