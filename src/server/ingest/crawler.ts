import type { Robots } from './robots';

import { sha256 } from './chunker';
import { extractHtml } from './html-extract';
import { parseRobots, allowAllRobots } from './robots';
import { BlockedUrlError, assertCrawlableUrl, guardedFetch as ssrfSafeFetch } from './url-guard';

export type CrawledPage = { url: string; title: string; markdown: string };

export type CrawlOptions = {
  maxPages: number;
  allowPrivateNetworks: boolean;
  timeoutMs?: number;
  concurrency?: number;
  userAgent?: string;
  maxBytes?: number;
  fetch?: typeof fetch;
  onProgress?: (p: { done: number; queued: number; url: string }) => void | Promise<void>;
  signal?: AbortSignal;
};

export type CrawlResult = {
  pages: CrawledPage[];
  skipped: { url: string; reason: string }[];
  usedSitemap: boolean;
};

export const DEFAULT_USER_AGENT = 'DocsBotCrawler/1.0 (+https://github.com/; respects robots.txt)';

const SKIP_EXT =
  /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|json|xml|txt|zip|gz|tar|rar|7z|mp3|mp4|mov|avi|webm|woff2?|ttf|eot|pdf|docx?|xlsx?|pptx?|csv)$/i;

/** Canonical form used for de-duplication: no hash, no default port, no tracking params, no trailing slash. */
export function normalizeUrl(raw: string): string | undefined {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const p of [...u.searchParams.keys()])
      if (/^(utm_|fbclid|gclid|ref$)/i.test(p)) u.searchParams.delete(p);
    u.searchParams.sort();
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return undefined;
  }
}

type Fetched = { url: string; status: number; contentType: string; body: string };

async function guardedFetch(rawUrl: string, opts: CrawlOptions, accept: string): Promise<Fetched> {
  // Public crawls go through the SSRF-guarded client; tests and local dev may inject/allow plain fetch.
  const f = opts.fetch ?? (opts.allowPrivateNetworks ? fetch : ssrfSafeFetch);
  let current = rawUrl;
  for (let hop = 0; hop <= 5; hop++) {
    assertCrawlableUrl(current, opts.allowPrivateNetworks);
    const init: RequestInit = {
      redirect: 'manual',
      headers: { 'user-agent': opts.userAgent ?? DEFAULT_USER_AGENT, accept },
      signal: AbortSignal.any([
        AbortSignal.timeout(opts.timeoutMs ?? 10_000),
        ...(opts.signal ? [opts.signal] : []),
      ]),
    };
    const res = await f(current, init);
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, current).toString();
      await res.body?.cancel();
      continue;
    }
    const contentType = res.headers.get('content-type') ?? '';
    const max = opts.maxBytes ?? 3_000_000;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > max) {
      await res.body?.cancel();
      return { url: current, status: 413, contentType, body: '' };
    }
    const text = await res.text();
    return {
      url: current,
      status: res.status,
      contentType,
      body: text.length > max ? text.slice(0, max) : text,
    };
  }
  throw new Error('Too many redirects');
}

function sitemapLocs(xml: string): { urls: string[]; sitemaps: string[] } {
  const urls: string[] = [];
  const sitemaps: string[] = [];
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    const loc = m[1]!.replace(/&amp;/g, '&');
    (isIndex ? sitemaps : urls).push(loc);
  }
  return { urls, sitemaps };
}

async function loadSitemaps(origin: string, robots: Robots, opts: CrawlOptions): Promise<string[]> {
  const queue = robots.sitemaps.length ? [...robots.sitemaps] : [`${origin}/sitemap.xml`];
  const found: string[] = [];
  const seen = new Set<string>();
  while (queue.length && seen.size < 10 && found.length < opts.maxPages * 3) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    try {
      if (new URL(sm).origin !== origin) continue;
      const res = await guardedFetch(sm, opts, 'application/xml,text/xml');
      if (res.status !== 200) continue;
      const { urls, sitemaps } = sitemapLocs(res.body);
      found.push(...urls);
      queue.push(...sitemaps);
    } catch {
      /* a broken sitemap is not fatal: fall back to link discovery */
    }
  }
  return found;
}

/**
 * Same-origin crawler: seeds from sitemap.xml (via robots.txt `Sitemap:` or /sitemap.xml) plus
 * the start URL, then discovers links breadth-first. Respects robots.txt rules, Crawl-delay,
 * `<meta name="robots" content="noindex|nofollow">` and rel=nofollow, and stops at `maxPages`.
 */
export async function crawlSite(startUrl: string, opts: CrawlOptions): Promise<CrawlResult> {
  const start = assertCrawlableUrl(startUrl, opts.allowPrivateNetworks);
  const origin = start.origin;
  const skipped: CrawlResult['skipped'] = [];

  let robots = allowAllRobots;
  try {
    const r = await guardedFetch(`${origin}/robots.txt`, opts, 'text/plain');
    if (r.status === 200) robots = parseRobots(r.body, opts.userAgent ?? DEFAULT_USER_AGENT);
    else if (r.status === 401 || r.status === 403)
      throw new Error(`robots.txt returned ${r.status}; refusing to crawl`);
  } catch (err) {
    if (err instanceof BlockedUrlError) throw err;
    if ((err as Error).message.includes('refusing to crawl')) throw err;
  }

  const sitemapUrls = await loadSitemaps(origin, robots, opts);
  const queue: string[] = [];
  const seen = new Set<string>();
  const enqueue = (raw: string) => {
    const n = normalizeUrl(raw);
    if (!n || seen.has(n)) return;
    const u = new URL(n);
    if (u.origin !== origin || SKIP_EXT.test(u.pathname)) return;
    seen.add(n);
    if (!robots.isAllowed(u.pathname + u.search)) {
      skipped.push({ url: n, reason: 'robots.txt' });
      return;
    }
    queue.push(n);
  };
  enqueue(start.toString());
  for (const u of sitemapUrls) enqueue(u);

  const pages: CrawledPage[] = [];
  const contentHashes = new Set<string>();
  const delay = Math.min(robots.crawlDelayMs ?? 0, 5_000);
  const concurrency = delay > 0 ? 1 : Math.max(1, opts.concurrency ?? 4);
  let fetched = 0;

  const visit = async (url: string) => {
    try {
      const res = await guardedFetch(url, opts, 'text/html,application/xhtml+xml');
      if (res.status !== 200) return skipped.push({ url, reason: `HTTP ${res.status}` });
      if (!/html/i.test(res.contentType))
        return skipped.push({ url, reason: `content-type ${res.contentType || 'unknown'}` });
      const finalUrl = normalizeUrl(res.url) ?? url;
      if (new URL(finalUrl).origin !== origin)
        return skipped.push({ url, reason: 'redirected off-site' });
      const page = extractHtml(res.body, finalUrl);
      if (!page.nofollow) for (const l of page.links) enqueue(l);
      if (page.noindex) return skipped.push({ url, reason: 'noindex' });
      if (page.markdown.length < 40) return skipped.push({ url, reason: 'no text content' });
      const hash = sha256(page.markdown);
      if (contentHashes.has(hash)) return skipped.push({ url, reason: 'duplicate content' });
      contentHashes.add(hash);
      pages.push({ url: finalUrl, title: page.title, markdown: page.markdown });
    } catch (err) {
      if (err instanceof BlockedUrlError) skipped.push({ url, reason: err.message });
      else skipped.push({ url, reason: (err as Error).message || 'fetch failed' });
    }
  };

  while (queue.length && pages.length < opts.maxPages) {
    opts.signal?.throwIfAborted();
    const batch = queue.splice(0, Math.min(concurrency, opts.maxPages - pages.length));
    await Promise.all(batch.map(visit));
    fetched += batch.length;
    await opts.onProgress?.({
      done: pages.length,
      queued: queue.length,
      url: batch[batch.length - 1]!,
    });
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (fetched > opts.maxPages * 4) break; // safety valve for sites full of empty/duplicate pages
  }
  for (const rest of queue) skipped.push({ url: rest, reason: 'page limit reached' });

  return { pages: pages.slice(0, opts.maxPages), skipped, usedSitemap: sitemapUrls.length > 0 };
}
