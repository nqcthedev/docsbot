export type PdfPage = { page: number; text: string };

/** Extracts text per page with pdf.js (via unpdf, no native dependencies). */
export async function extractPdf(data: Uint8Array): Promise<{ title?: string; pages: PdfPage[] }> {
  const { getDocumentProxy, extractText, getMeta } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(data));
  let title: string | undefined;
  try {
    const meta = await getMeta(pdf);
    const t = (meta.info as { Title?: unknown } | undefined)?.Title;
    title = typeof t === 'string' && t.trim() ? t.trim() : undefined;
  } catch {
    title = undefined;
  }
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [text]).map((t, i) => ({
    page: i + 1,
    text: normalizePdfText(t),
  }));
  return { title, pages: pages.filter((p) => p.text.length > 0) };
}

/** pdf.js returns lines; rebuild paragraphs and drop hyphenation at line ends. */
export function normalizePdfText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/-\n(?=[a-z])/g, '')
    .split(/\n{2,}/)
    .map((p) => p.replace(/[ \t]*\n[ \t]*/g, '\n').trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
