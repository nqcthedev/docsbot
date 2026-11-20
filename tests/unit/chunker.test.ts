import { describe, expect, it } from "vitest";
import { chunkMarkdown, embeddingText } from "@/server/ingest/chunker";

const para = (n: number, word = "coffee") => Array.from({ length: n }, (_, i) => `${word} sentence number ${i} is here.`).join(" ");

describe("chunkMarkdown", () => {
  it("keeps small documents in a single chunk with their heading path", () => {
    const chunks = chunkMarkdown("# Shipping\n\nWe ship on roast days.\n\n## Canada\n\nFlat rate of $16.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toContain("## Canada");
    expect(chunks[0]!.headingPath).toBe("Shipping");
  });

  it("starts new chunks at sections when content exceeds the limit and tracks nested headings", () => {
    const md = `# Shipping\n\n${para(12)}\n\n## United States\n\n${para(12, "domestic")}\n\n## Canada\n\n${para(12, "canada")}`;
    const chunks = chunkMarkdown(md, { maxChars: 600, overlapChars: 100 });
    const canada = chunks.find((c) => c.content.includes("canada sentence"));
    expect(canada?.headingPath).toBe("Shipping › Canada");
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(600);
  });

  it("splits long sections with overlap and repeats the section heading", () => {
    const md = `## Returns\n\n${para(60, "refund")}`;
    const chunks = chunkMarkdown(md, { maxChars: 500, overlapChars: 120 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.content.startsWith("## Returns")).toBe(true);
      expect(c.headingPath).toBe("Returns");
      expect(c.content.length).toBeLessThanOrEqual(500);
    }
    // Overlap: the tail of chunk N appears at the start of chunk N+1.
    const firstBody = chunks[0]!.content.replace("## Returns\n\n", "");
    const lastSentence = firstBody.trim().split(/(?<=\.)\s+/).pop()!;
    expect(chunks[1]!.content).toContain(lastSentence);
  });

  it("hard-splits a single enormous sentence", () => {
    const chunks = chunkMarkdown("x".repeat(3000), { maxChars: 1000, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.every((c) => c.content.length <= 1000)).toBe(true);
  });

  it("produces stable ordinals, token estimates and content hashes", () => {
    const a = chunkMarkdown(`# A\n\n${para(30)}`, { maxChars: 400 });
    const b = chunkMarkdown(`# A\n\n${para(30)}`, { maxChars: 400 });
    expect(a.map((c) => c.ordinal)).toEqual(a.map((_, i) => i));
    expect(a.map((c) => c.contentHash)).toEqual(b.map((c) => c.contentHash));
    expect(a[0]!.tokenCount).toBe(Math.ceil(a[0]!.content.length / 4));
  });

  it("returns nothing for empty input", () => {
    expect(chunkMarkdown("   \n\n  ")).toEqual([]);
  });
});

describe("embeddingText", () => {
  it("prefixes the document title and heading trail", () => {
    expect(embeddingText("Shipping Information", { headingPath: "Canada", content: "Flat rate $16." })).toBe("Shipping Information › Canada\n\nFlat rate $16.");
  });
});
