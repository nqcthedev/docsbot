/** Up to this maximum every integer gets a gridline; above it only 0, the midpoint and max. */
const MAX_DENSE_TICKS = 4;

// ----------------------------------------------------------------------

/** Gridline values for a bar chart whose tallest bar is `max`. */
export function barChartTicks(max: number) {
  return max <= MAX_DENSE_TICKS
    ? Array.from({ length: max + 1 }, (_, tick) => tick)
    : [0, Math.round(max / 2), max];
}
