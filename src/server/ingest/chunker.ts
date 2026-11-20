import { createHash } from "node:crypto";

export type ChunkOptions = {
  /** Target maximum characters per chunk (~4 chars per token). */
  maxChars?: number;
  /** Characters of trailing context carried into the next chunk of the same section. */
  overlapChars?: number;
  /** Sections shorter than this are merged with their neighbours. */
  minChars?: number;
};

export type Chunk = {
  ordinal: number;
  /** Chunk text as shown to the LLM (includes the in-chunk headings). */
  content: string;
  /** "Shipping › International › Canada" — the heading trail of the chunk's first section. */
  headingPath: string;
  tokenCount: number;
  contentHash: string;
};

type Section = { path: string[]; heading?: string; body: string[] };

const HEADING = /^(#{1,6})\s+(.*)$/;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const approxTokens = (s: string) => Math.ceil(s.length / 4);

function splitSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const stack: { level: number; text: string }[] = [];
  let current: Section = { path: [], body: [] };
  for (const block of markdown.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
    const m = block.match(HEADING);
    if (m && !block.includes("\n")) {
      if (current.heading || current.body.length) sections.push(current);
      const level = m[1]!.length;
      const text = m[2]!.trim();
      while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
      stack.push({ level, text });
      current = { path: stack.map((s) => s.text), heading: block, body: [] };
    } else {
      current.body.push(block);
    }
  }
  if (current.heading || current.body.length) sections.push(current);
  return sections;
}

/** Splits an oversized paragraph on sentence boundaries, hard-wrapping as a last resort. */
function splitLong(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?]+(?:[.!?]+["')\]]*\s*|$)/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (s.length > maxChars) {
      if (buf) out.push(buf.trim());
      buf = "";
      for (let i = 0; i < s.length; i += maxChars) out.push(s.slice(i, i + maxChars).trim());
      continue;
    }
    if ((buf + s).length > maxChars && buf) {
      out.push(buf.trim());
      buf = "";
    }
    buf += s;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function tail(text: string, chars: number): string {
  if (chars <= 0 || text.length <= chars) return chars <= 0 ? "" : text;
  const slice = text.slice(-chars);
  // Start the overlap at a sentence or word boundary so it reads naturally.
  const sentence = slice.search(/[.!?]\s+[A-Z0-9]/);
  if (sentence !== -1 && sentence < chars / 2) return slice.slice(sentence + 1).trim();
  const space = slice.indexOf(" ");
  return space === -1 ? slice : slice.slice(space + 1);
}

/**
 * Heading-aware chunker. Sections (heading + body) are packed greedily into chunks of at most
 * `maxChars`; long sections are split on paragraph then sentence boundaries, and each
 * continuation chunk repeats the section heading plus `overlapChars` of preceding text.
 */
export function chunkMarkdown(markdown: string, options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? 1200;
  const overlapChars = Math.min(options.overlapChars ?? 200, Math.floor(maxChars / 3));
  const minChars = options.minChars ?? 250;
  const sections = splitSections(markdown);

  const pieces: { text: string; path: string[] }[] = [];
  let pack: { text: string; path: string[] } | undefined;

  const emit = () => {
    if (pack && pack.text.trim()) pieces.push(pack);
    pack = undefined;
  };

  for (const section of sections) {
    const full = [section.heading, ...section.body].filter(Boolean).join("\n\n");
    if (full.length <= maxChars) {
      // Pack small whole sections together while they fit.
      if (pack && pack.text.length + 2 + full.length <= maxChars && (pack.text.length < minChars || full.length < minChars || pack.text.length + full.length <= maxChars)) {
        pack.text += "\n\n" + full;
      } else {
        emit();
        pack = { text: full, path: section.path };
      }
      continue;
    }

    emit();
    const header = section.heading ? section.heading + "\n\n" : "";
    const paragraphs = section.body.flatMap((p) => splitLong(p, maxChars - header.length - overlapChars - 2));
    let buf = header;
    let previous = "";
    for (const p of paragraphs) {
      if (buf.length + p.length + 2 > maxChars && buf.trim() !== header.trim()) {
        pieces.push({ text: buf.trim(), path: section.path });
        previous = buf.slice(header.length);
        const overlap = tail(previous, overlapChars);
        buf = header + (overlap ? overlap + "\n\n" : "");
      }
      buf += p + "\n\n";
    }
    if (buf.trim() && buf.trim() !== header.trim()) pieces.push({ text: buf.trim(), path: section.path });
  }
  emit();

  return pieces.map((p, i) => ({
    ordinal: i,
    content: p.text,
    headingPath: p.path.join(" › "),
    tokenCount: approxTokens(p.text),
    contentHash: sha256(p.text),
  }));
}

/** Text that gets embedded: document title and heading trail give each chunk standalone context. */
export function embeddingText(docTitle: string, chunk: Pick<Chunk, "headingPath" | "content">): string {
  const ctx = [docTitle, chunk.headingPath].filter(Boolean).join(" › ");
  return ctx ? `${ctx}\n\n${chunk.content}` : chunk.content;
}
