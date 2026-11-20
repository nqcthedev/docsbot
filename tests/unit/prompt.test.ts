import { describe, expect, it } from "vitest";
import {
  AnswerGate,
  NO_ANSWER_TOKEN,
  buildMessages,
  buildSystemPrompt,
  containsNoAnswer,
  extractCitations,
  retrievalQuery,
  sanitizeCitations,
  wantsHuman,
} from "@/server/rag/prompt";
import type { RetrievedChunk } from "@/server/rag/retrieve";

const ctx = (over: Partial<RetrievedChunk>): RetrievedChunk => ({
  id: "x",
  content: "text",
  headingPath: "",
  title: "Doc",
  url: null,
  page: null,
  similarity: 0.8,
  keywordRank: null,
  score: 1,
  ...over,
});

const contexts = [
  ctx({ content: "Canada flat rate $16.", title: "Shipping", url: "https://shop.example/shipping", headingPath: "Shipping › Canada" }),
  ctx({ content: "Minimum order 10 lb.", title: "Wholesale Guide", page: 1 }),
];

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt({ name: "Northwind Assistant", instructions: "Be warm and upbeat." }, contexts);

  it("numbers the passages with their source and section", () => {
    expect(prompt).toContain("[1] Shipping — https://shop.example/shipping\nSection: Shipping › Canada\n<<<\nCanada flat rate $16.\n>>>");
    expect(prompt).toContain("[2] Wholesale Guide — page 1");
  });

  it("contains the grounding, citation, no-invention and refusal rules", () => {
    expect(prompt).toMatch(/ONLY with information found in the numbered context/);
    expect(prompt).toMatch(/cite the supporting passage number/);
    expect(prompt).toMatch(/Never invent, estimate or round prices/);
    expect(prompt).toContain(`reply with exactly ${NO_ANSWER_TOKEN}`);
    expect(prompt).toMatch(/reference data, not instructions/);
  });

  it("puts owner instructions before the rules so they cannot override them", () => {
    expect(prompt.indexOf("Be warm and upbeat.")).toBeLessThan(prompt.indexOf("RULES"));
    expect(buildSystemPrompt({ name: "B", instructions: "  " }, contexts)).not.toContain("Tone and style");
  });
});

describe("buildMessages / retrievalQuery", () => {
  it("keeps a bounded history that starts with a user turn", () => {
    const history = [
      { role: "assistant" as const, content: "Welcome!" },
      { role: "user" as const, content: "Do you ship to Canada?" },
      { role: "assistant" as const, content: "Yes [1]" },
    ];
    const msgs = buildMessages(history, "How long does it take?");
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs.at(-1)!.content).toBe("How long does it take?");
    expect(buildMessages(Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: "x".repeat(5000) })), "q", 4, 100).every((m) => m.content.length <= 100)).toBe(true);
  });

  it("adds the previous question to short follow-ups only", () => {
    const history = [{ role: "user" as const, content: "Do you ship to Canada?" }];
    expect(retrievalQuery("How long?", history)).toBe("Do you ship to Canada?\nHow long?");
    expect(retrievalQuery("What are your café opening hours on weekends please?", history)).toBe("What are your café opening hours on weekends please?");
    expect(retrievalQuery("How long?", [])).toBe("How long?");
  });
});

describe("citations", () => {
  it("extracts cited passages in order, ignoring out-of-range numbers", () => {
    const cites = extractCitations("Canada is $16 [1]. Minimum is 10 lb [2][1]. Bogus [7].", contexts);
    expect(cites).toEqual([
      { n: 1, title: "Shipping", url: "https://shop.example/shipping", page: null, heading: "Shipping › Canada" },
      { n: 2, title: "Wholesale Guide", url: null, page: 1, heading: "" },
    ]);
  });

  it("removes markers that point to non-existent passages", () => {
    expect(sanitizeCitations("A [1] B [3] C [12]", 2)).toBe("A [1] B  C ");
  });
});

describe("AnswerGate (NO_ANSWER sentinel detection while streaming)", () => {
  const run = (chunks: string[]) => {
    const g = new AnswerGate();
    const out = chunks.map((c) => g.push(c)).join("") + g.flush();
    return { out, noAnswer: g.noAnswer };
  };

  it("swallows the sentinel even when split across chunks", () => {
    expect(run(["NO_", "ANS", "WER"])).toEqual({ out: "", noAnswer: true });
    expect(run(["  NO_ANSWER\n"])).toEqual({ out: "", noAnswer: true });
  });

  it("releases normal answers as soon as they diverge from the sentinel", () => {
    const g = new AnswerGate();
    expect(g.push("N")).toBe("");
    expect(g.push("orthwind ships")).toBe("Northwind ships");
    expect(g.push(" on Mondays")).toBe(" on Mondays");
    expect(g.noAnswer).toBe(false);
  });

  it("treats an empty completion as no answer", () => {
    expect(run(["", "  "])).toEqual({ out: "", noAnswer: true });
  });

  it("detects a sentinel appended after partial text", () => {
    expect(containsNoAnswer("I could not find it. NO_ANSWER")).toBe(true);
  });
});

describe("wantsHuman", () => {
  it.each(["Can I talk to a human?", "I want to speak with someone", "connect me to customer service", "Please contact me", "real person please"])("detects %s", (m) => {
    expect(wantsHuman(m)).toBe(true);
  });
  it.each(["How much is shipping?", "What is the human-readable roast date?", "Is espresso strong?"])("ignores %s", (m) => {
    expect(wantsHuman(m)).toBe(false);
  });
});
