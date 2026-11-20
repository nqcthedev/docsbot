/**
 * Allowed-domain handling for the embeddable widget. Entries look like `example.com`,
 * `*.example.com` or `localhost:3000`. An empty list means "any site" (shown as a warning
 * in the dashboard).
 */
export function normalizeDomainEntry(raw: string): string | undefined {
  let v = raw.trim().toLowerCase();
  if (!v) return undefined;
  v = v.replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '');
  const wildcard = v.startsWith('*.');
  const host = wildcard ? v.slice(2) : v;
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/.test(host) || host.startsWith('.') || host.includes('..'))
    return undefined;
  return wildcard ? `*.${host}` : host;
}

export function parseDomainList(text: string): { domains: string[]; invalid: string[] } {
  const domains = new Set<string>();
  const invalid: string[] = [];
  for (const part of text.split(/[\s,]+/)) {
    if (!part.trim()) continue;
    const n = normalizeDomainEntry(part);
    if (n) domains.add(n);
    else invalid.push(part.trim());
  }
  return { domains: [...domains], invalid };
}

/** Does `origin` (e.g. "https://shop.example.com") match one of the allowed entries? */
export function isOriginAllowed(origin: string | null | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const hostPort = url.host.toLowerCase();
  return allowed.some((entry) => {
    if (entry.startsWith('*.')) {
      const base = entry.slice(2);
      return host === base || host.endsWith('.' + base);
    }
    return entry.includes(':') ? hostPort === entry : host === entry || host === `www.${entry}`;
  });
}

/** CSP frame-ancestors value enforced by the browser on the widget iframe. */
export function frameAncestors(allowed: string[]): string {
  if (allowed.length === 0) return 'frame-ancestors *';
  const sources = new Set<string>(["'self'"]);
  for (const entry of allowed) {
    for (const scheme of ['https', 'http']) {
      sources.add(`${scheme}://${entry}`);
      if (!entry.startsWith('*.') && !entry.includes(':') && !entry.startsWith('www.'))
        sources.add(`${scheme}://www.${entry}`);
    }
  }
  return `frame-ancestors ${[...sources].join(' ')}`;
}
