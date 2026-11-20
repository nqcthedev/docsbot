import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProviderRegistry } from "@/server/ai/registry";
import { ProviderError, type ChatChunk, type ChatProvider, type ChatRequest } from "@/server/ai/types";
import type { Database } from "@/server/db";
import { bots, conversations, messages, sources, usageEvents, type Bot } from "@/server/db/schema";
import { ingestSource } from "@/server/ingest/pipeline";
import { logger } from "@/server/logger";
import { answerQuestion, ERROR_MESSAGE, HANDOFF_MESSAGE, type AnswerEvent } from "@/server/rag/answer";
import { keywordEmbeddings, seedBot, testDb } from "./helpers";

/** Chat provider that replays a scripted reply and records the prompt it received. */
function fakeChat(reply: string | ProviderError): ChatProvider & { last?: ChatRequest } {
  const p: ChatProvider & { last?: ChatRequest } = {
    name: "gemini",
    async *stream(req): AsyncGenerator<ChatChunk> {
      p.last = req;
      if (reply instanceof ProviderError) throw reply;
      for (const piece of reply.match(/.{1,7}/gs) ?? []) yield { type: "text", text: piece };
      yield { type: "usage", inputTokens: 900, outputTokens: 40 };
    },
  };
  return p;
}

describe("answerQuestion", () => {
  let db: Database;
  let close: () => Promise<void>;
  let bot: Bot;
  const embeddings = keywordEmbeddings(["shipping", "canada", "refund", "espresso"]);

  beforeAll(async () => {
    ({ db, close } = await testDb());
    bot = await seedBot(db, { minSimilarity: 0.5, chatModel: "gemini-2.5-flash" });
    const [src] = await db
      .insert(sources)
      .values({ botId: bot.id, type: "text", name: "Shipping FAQ", textContent: "# Shipping\n\nShipping to Canada is a flat $16.\n\n# Refunds\n\nRefunds within 30 days." })
      .returning();
    await ingestSource(src!.id, { db, embeddings, allowPrivateNetworks: true, maxPagesCap: 5, crawlTimeoutMs: 1000, logger });
    [bot] = await db.select().from(bots).where(eq(bots.id, bot.id));
  });
  afterAll(() => close());

  async function ask(question: string, chat: ChatProvider, botOverride: Partial<Bot> = {}) {
    const [conv] = await db.insert(conversations).values({ botId: bot.id, visitorId: "v1", channel: "widget" }).returning();
    const events: AnswerEvent[] = [];
    const registry: ProviderRegistry = { chat: { gemini: chat }, embeddings, configured: ["gemini"] };
    const res = await answerQuestion({
      db,
      registry,
      bot: { ...bot, ...botOverride },
      conversationId: conv!.id,
      question,
      history: [],
      emit: (e) => void events.push(e),
      logger,
      fallbackOptions: { maxRetries: 0, sleep: async () => {} },
      fallbackModels: "",
    });
    const streamed = events.filter((e) => e.type === "token").map((e) => (e as { text: string }).text).join("");
    const done = events.find((e) => e.type === "done") as Extract<AnswerEvent, { type: "done" }>;
    return { res, events, streamed, done, conversationId: conv!.id };
  }

  it("streams a grounded answer with citations and records usage and cost", async () => {
    const chat = fakeChat("We ship to Canada for a flat $16 [1].");
    const { streamed, done, res, conversationId } = await ask("How much is shipping to Canada?", chat);
    expect(streamed).toBe("We ship to Canada for a flat $16 [1].");
    expect(done).toMatchObject({ answered: true, outcome: "answered", offerLead: false });
    expect(done.citations).toEqual([expect.objectContaining({ n: 1, title: "Shipping FAQ" })]);
    expect(chat.last!.system).toContain("Shipping to Canada is a flat $16.");
    const [saved] = await db.select().from(messages).where(eq(messages.id, res.messageId));
    expect(saved).toMatchObject({ role: "assistant", answered: true, provider: "gemini", model: "gemini-2.5-flash", inputTokens: 900, outputTokens: 40 });
    const usage = await db.select().from(usageEvents).where(eq(usageEvents.kind, "chat"));
    expect(usage.at(-1)!.costUsd).toBeCloseTo((900 * 0.3 + 40 * 2.5) / 1e6, 10);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
    expect(conv!.messageCount).toBe(1);
  });

  it("declines without calling the LLM when retrieval confidence is below the threshold", async () => {
    const chat = fakeChat("should not be called");
    const { done, streamed } = await ask("Do you sell teapots?", chat);
    expect(chat.last).toBeUndefined();
    expect(streamed).toBe(bot.fallbackMessage);
    expect(done).toMatchObject({ answered: false, outcome: "low_confidence", offerLead: true });
  });

  it("respects a stricter per-bot threshold", async () => {
    const { done } = await ask("How much is shipping to Canada?", fakeChat("x [1]"), { minSimilarity: 0.999 });
    expect(done.outcome).toBe("low_confidence");
  });

  it("replaces a NO_ANSWER reply with the fallback message and offers lead capture", async () => {
    const { done, streamed } = await ask("Is shipping to Canada carbon neutral?", fakeChat("NO_ANSWER"));
    expect(streamed).toBe(bot.fallbackMessage);
    expect(streamed).not.toContain("NO_ANSWER");
    expect(done).toMatchObject({ answered: false, outcome: "no_answer", offerLead: true });
  });

  it("offers a human handoff when asked, even if the question is answerable", async () => {
    const { done } = await ask("Can I talk to a human about shipping to Canada?", fakeChat("Shipping to Canada is $16 [1]."));
    expect(done).toMatchObject({ answered: true, offerLead: true });
    const low = await ask("I want to speak with a human", fakeChat("x"));
    expect(low.streamed).toBe(HANDOFF_MESSAGE);
    expect(low.done.outcome).toBe("handoff");
  });

  it("answers gracefully when every provider fails", async () => {
    const { done, streamed } = await ask("shipping to canada?", fakeChat(new ProviderError("down", "gemini", { status: 503, retryable: true })));
    expect(streamed).toBe(ERROR_MESSAGE);
    expect(done).toMatchObject({ answered: false, outcome: "error" });
  });

  it("strips citation markers that reference non-existent passages", async () => {
    const { done } = await ask("refund policy?", fakeChat("Refunds within 30 days [1][9]."));
    expect(done.replaceWith).toBe("Refunds within 30 days [1].");
  });
});
