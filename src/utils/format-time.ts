const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** Past this many days a relative time ("45d ago") is less useful than the calendar date. */
const MAX_RELATIVE_DAYS = 30;

type DateInput = Date | string;

const toDate = (date: DateInput) => (typeof date === 'string' ? new Date(date) : date);

// ----------------------------------------------------------------------

export function formatTimeAgo(date: DateInput, now: number = Date.now()) {
  const value = toDate(date);
  const seconds = Math.round((now - value.getTime()) / 1000);
  if (seconds < SECONDS_PER_MINUTE) return 'just now';

  const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`;

  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h ago`;

  const days = Math.round(hours / HOURS_PER_DAY);
  if (days < MAX_RELATIVE_DAYS) return `${days}d ago`;

  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ----------------------------------------------------------------------

export function formatDateTime(date: DateInput) {
  return toDate(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ----------------------------------------------------------------------

/** "2026-11-20" → "11/20", a compact chart axis label. */
export function formatMonthDay(isoDay: string) {
  return isoDay.slice(5).replace('-', '/');
}
