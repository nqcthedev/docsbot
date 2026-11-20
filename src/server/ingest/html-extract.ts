import type { AnyNode, Element } from 'domhandler';

import * as cheerio from 'cheerio';

export type ExtractedPage = {
  title: string;
  /** Markdown-ish text: `#` headings, paragraphs, `- ` list items, `a | b` table rows. */
  markdown: string;
  links: string[];
  noindex: boolean;
  nofollow: boolean;
  canonical?: string;
};

const DROP = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'iframe',
  'object',
  'embed',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  'nav',
  'header',
  'footer',
  'aside',
  'dialog',
  '[role=navigation]',
  '[role=banner]',
  '[role=contentinfo]',
  '[aria-hidden=true]',
  '[hidden]',
  '.cookie-banner',
  '.cookie',
  '.skip-link',
  '.sr-only',
  '.visually-hidden',
].join(',');

const BLOCK = new Set([
  'p',
  'div',
  'section',
  'article',
  'main',
  'blockquote',
  'figure',
  'figcaption',
  'address',
  'ul',
  'ol',
  'dl',
  'dt',
  'dd',
  'details',
  'summary',
  'body',
  'html',
]);

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function extractHtml(html: string, pageUrl: string): ExtractedPage {
  const $ = cheerio.load(html);
  const robotsMeta = ($('meta[name="robots"]').attr('content') ?? '').toLowerCase();
  const base = $('base[href]').attr('href');
  const baseUrl = base ? new URL(base, pageUrl).toString() : pageUrl;

  const links = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    const rel = ($(el).attr('rel') ?? '').toLowerCase();
    if (
      !href ||
      href.startsWith('#') ||
      /^(mailto|tel|javascript|data):/i.test(href) ||
      rel.includes('nofollow')
    )
      return;
    try {
      const u = new URL(href, baseUrl);
      u.hash = '';
      links.add(u.toString());
    } catch {
      /* ignore malformed hrefs */
    }
  });

  const canonicalHref = $('link[rel="canonical"]').attr('href');
  let canonical: string | undefined;
  try {
    canonical = canonicalHref ? new URL(canonicalHref, baseUrl).toString() : undefined;
  } catch {
    canonical = undefined;
  }

  const title =
    clean($('meta[property="og:title"]').attr('content') ?? '') ||
    clean($('title').first().text()) ||
    clean($('h1').first().text()) ||
    new URL(pageUrl).pathname;

  $(DROP).remove();
  const root = $('main').first().length
    ? $('main').first()
    : $('article').first().length
      ? $('article').first()
      : $('[role="main"]').first().length
        ? $('[role="main"]').first()
        : $('body');

  const out: string[] = [];
  let inline = '';
  const flush = () => {
    const t = clean(inline);
    if (t) out.push(t);
    inline = '';
  };

  const textOf = (el: Element) => clean($(el).text());

  const walk = (node: AnyNode) => {
    if (node.type === 'text') {
      inline += (node as unknown as { data: string }).data;
      return;
    }
    if (node.type !== 'tag') return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      flush();
      const t = textOf(el);
      if (t) out.push(`${'#'.repeat(Number(tag[1]))} ${t}`);
      return;
    }
    if (tag === 'br') {
      inline += ' ';
      return;
    }
    if (tag === 'li') {
      flush();
      const nested = $(el).children('ul,ol');
      const own = clean($(el).clone().children('ul,ol').remove().end().text());
      if (own) out.push(`- ${own}`);
      nested.each((_, n) => walk(n));
      return;
    }
    if (tag === 'pre') {
      flush();
      const t = $(el).text().trim();
      if (t) out.push(t);
      return;
    }
    if (tag === 'table') {
      flush();
      $(el)
        .find('tr')
        .each((_, tr) => {
          const cells = $(tr)
            .children('th,td')
            .map((__, c) => clean($(c).text()))
            .get()
            .filter(Boolean);
          if (cells.length) out.push(cells.join(' | '));
        });
      return;
    }
    if (tag === 'img') {
      const alt = clean($(el).attr('alt') ?? '');
      if (alt) inline += ` ${alt} `;
      return;
    }
    const block = BLOCK.has(tag);
    if (block) flush();
    for (const child of el.children) walk(child);
    if (block) flush();
  };

  for (const child of root.get(0)?.children ?? []) walk(child);
  flush();

  // Paragraph separation, collapsing consecutive duplicates (e.g. repeated banners).
  const deduped = out.filter((line, i) => line !== out[i - 1]);
  return {
    title,
    markdown: deduped.join('\n\n'),
    links: [...links],
    noindex: robotsMeta.includes('noindex'),
    nofollow: robotsMeta.includes('nofollow'),
    canonical,
  };
}
