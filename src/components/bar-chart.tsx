/** Minimal accessible SVG bar chart (server-rendered, no client JS). */
export function BarChart({ data, color = "var(--color-brand-500)", height = 140 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const gap = 6;
  const width = 600;
  const barW = (width - gap * (n - 1)) / n;
  const chartH = height - 22;
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  return (
    <svg viewBox={`0 0 ${width + 28} ${height}`} className="w-full" role="img" aria-label="Conversations per day">
      {ticks.map((t) => {
        const y = chartH - (t / max) * chartH;
        return (
          <g key={t}>
            <line x1={28} x2={width + 28} y1={y} y2={y} stroke="#e4e4e7" strokeDasharray={t === 0 ? undefined : "3 3"} />
            <text x={20} y={y + 4} textAnchor="end" fontSize="10" fill="#a1a1aa">
              {t}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * chartH;
        const x = 28 + i * (barW + gap);
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${d.value}`}</title>
            <rect x={x} y={chartH - h} width={barW} height={Math.max(h, d.value ? 2 : 0)} rx={3} fill={color} />
            {i % 2 === 0 || n <= 8 ? (
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="#71717a">
                {d.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
