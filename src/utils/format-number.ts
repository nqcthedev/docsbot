const numberFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Below one cent, currency formatting would round AI costs to "$0.00" and hide real spend. */
const SUB_CENT_THRESHOLD_USD = 0.01;

// ----------------------------------------------------------------------

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

// ----------------------------------------------------------------------

export function formatUsd(value: number) {
  if (value === 0) return '$0.00';
  if (value < SUB_CENT_THRESHOLD_USD) return `$${value.toFixed(4)}`;
  return usdFormatter.format(value);
}

// ----------------------------------------------------------------------

/** "1 page", "12 chunks": English plural by appending "s". */
export function formatCount(count: number, noun: string) {
  return `${formatNumber(count)} ${noun}${count === 1 ? '' : 's'}`;
}
