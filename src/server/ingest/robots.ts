/**
 * robots.txt parser implementing the commonly used subset of RFC 9309:
 * user-agent groups, Allow/Disallow with `*` and `$` wildcards (longest match wins,
 * Allow wins ties), Crawl-delay and Sitemap lines.
 */
type Rule = { allow: boolean; pattern: string; regex: RegExp };
type Group = { agents: string[]; rules: Rule[]; crawlDelay?: number };

export type Robots = {
  isAllowed(pathAndQuery: string): boolean;
  crawlDelayMs?: number;
  sitemaps: string[];
};

function toRegex(pattern: string): RegExp {
  let src = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === '*') src += '.*';
    else if (c === '$' && i === pattern.length - 1) src += '$';
    else src += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + src);
}

export function parseRobots(text: string, userAgent: string): Robots {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | undefined;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (key === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (!value) continue; // "Disallow:" (empty) means allow everything
      current.rules.push({ allow: key === 'allow', pattern: value, regex: toRegex(value) });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  const ua = userAgent.toLowerCase();
  const token = ua.split('/')[0]!.trim();
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== '*' && (token.includes(a) || a.includes(token)))
  );
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);
  const delay = chosen.map((g) => g.crawlDelay).find((d) => d !== undefined);

  return {
    sitemaps,
    crawlDelayMs: delay !== undefined ? delay * 1000 : undefined,
    isAllowed(path: string) {
      if (path === '/robots.txt') return true;
      let best: Rule | undefined;
      for (const r of rules) {
        if (!r.regex.test(path)) continue;
        if (
          !best ||
          r.pattern.length > best.pattern.length ||
          (r.pattern.length === best.pattern.length && r.allow)
        )
          best = r;
      }
      return best ? best.allow : true;
    },
  };
}

export const allowAllRobots: Robots = { isAllowed: () => true, sitemaps: [] };
