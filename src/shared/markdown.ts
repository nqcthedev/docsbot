/**
 * Tiny, safe Markdown subset renderer for bot answers (used by the widget and the dashboard).
 * Everything is HTML-escaped first; only a fixed set of tags is generated, and links are only
 * created for citation markers whose URL comes from our own retrieval results (http/https only).
 */
export type CitationRef = { n: number; title: string; url: string | null; page: number | null };

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function citationLabel(c: CitationRef): string {
  return c.page ? `${c.title}, page ${c.page}` : c.title;
}

function inline(text: string, cites: Map<number, CitationRef>): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[(\d{1,2})\]/g, (all, n: string) => {
    const c = cites.get(Number(n));
    if (!c) return '';
    const title = escapeHtml(citationLabel(c));
    const url = safeUrl(c.url);
    return url
      ? `<a class="cite" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${title}">${n}</a>`
      : `<span class="cite" title="${title}">${n}</span>`;
  });
  return out;
}

export function renderMarkdown(text: string, citations: CitationRef[] = []): string {
  const cites = new Map(citations.map((c) => [c.n, c]));
  const lines = text.replace(/\r/g, '').split('\n');
  const html: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | undefined;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) html.push(`<p>${para.map((l) => inline(l, cites)).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list)
      html.push(
        `<${list.type}>${list.items.map((i) => `<li>${inline(i, cites)}</li>`).join('')}</${list.type}>`
      );
    list = undefined;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      flushList();
    } else if (bullet || numbered) {
      flushPara();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]!);
    } else if (heading) {
      flushPara();
      flushList();
      html.push(`<p><strong>${inline(heading[1]!, cites)}</strong></p>`);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return html.join('');
}
