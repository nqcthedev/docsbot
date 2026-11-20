import { describe, expect, it, vi } from "vitest";
import { AnthropicChat } from "@/server/ai/anthropic";
import { OpenAICompatibleEmbeddings } from "@/server/ai/embeddings";
import { AllProvidersFailedError, StreamInterruptedError, backoffDelay, streamWithFallback, type Candidate } from "@/server/ai/fallback";
import { OpenAICompatibleChat } from "@/server/ai/openai-compatible";
import { buildRegistry, chatCandidates } from "@/server/ai/registry";
import { ProviderError, type ChatChunk, type ChatProvider, type FetchLike } from "@/server/ai/types";
import { envSchema } from "@/server/env";

const sse = (events: unknown[], { done = true } = {}) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + (done ? "data: [DONE]\n\n" : ""), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

/** fetch mock that returns queued responses in order and records requests. */
function mockFetch(...responses: (Response | Error | (() => Response | Promise<Response>))[]) {
  const calls: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fn: FetchLike = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
    const rawBody = input instanceof Request ? await input.text() : (init?.body as string | undefined);
    calls.push({ url, body: rawBody ? JSON.parse(rawBody) : {}, headers });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next() : next;
  };
  return Object.assign(fn, { calls });
}

async function collect(gen: AsyncIterable<unknown>) {
  const out: unknown[] = [];
  for await (const x of gen) out.push(x);
  return out;
}

const noSleep = async () => {};
const req = { system: "sys", messages: [{ role: "user" as const, content: "hi" }] };

describe("OpenAICompatibleChat", () => {
  it("streams text deltas and reports usage (Gemini sends cumulative usage on every chunk)", async () => {
    const f = mockFetch(
      sse([
        { choices: [{ delta: { content: "Hello" } }], usage: { prompt_tokens: 10, completion_tokens: 1 } },
        { choices: [{ delta: { content: " there" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 2 } },
      ]),
    );
    const p = new OpenAICompatibleChat({
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: "k",
      timeoutMs: 5000,
      fetch: f,
      modelParams: () => ({ reasoning_effort: "none" }),
    });
    const out = await collect(p.stream({ ...req, model: "gemini-2.5-flash", temperature: 0.2 }));
    expect(out).toEqual([
      { type: "text", text: "Hello" },
      { type: "text", text: " there" },
      { type: "usage", inputTokens: 10, outputTokens: 2 },
    ]);
    expect(f.calls[0]!.url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(f.calls[0]!.headers.get("authorization")).toBe("Bearer k");
    expect(f.calls[0]!.body).toMatchObject({ model: "gemini-2.5-flash", stream: true, reasoning_effort: "none", messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }] });
  });

  it("classifies HTTP errors as retryable or not and reads Retry-After", async () => {
    const p = (r: Response) => new OpenAICompatibleChat({ name: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "k", timeoutMs: 5000, fetch: mockFetch(r) });
    const e429 = await collect(p(json(429, { error: { message: "slow down" } }, { "retry-after": "3" })).stream({ ...req, model: "m" })).catch((e) => e);
    expect(e429).toBeInstanceOf(ProviderError);
    expect(e429).toMatchObject({ retryable: true, status: 429, retryAfterMs: 3000 });
    expect(e429.message).toContain("slow down");
    const e401 = await collect(p(json(401, [{ error: { message: "bad key" } }])).stream({ ...req, model: "m" })).catch((e) => e);
    expect(e401).toMatchObject({ retryable: false, status: 401 });
  });

  it("turns network failures into retryable errors", async () => {
    const p = new OpenAICompatibleChat({ name: "openai", baseUrl: "https://x", apiKey: "k", timeoutMs: 5000, fetch: mockFetch(new TypeError("fetch failed")) });
    await expect(collect(p.stream({ ...req, model: "m" }))).rejects.toMatchObject({ retryable: true, provider: "openai" });
  });

  it("times out stalled streams", async () => {
    const stalled = () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "a" } }] })}\n\n`));
          },
        }),
        { status: 200 },
      );
    const p = new OpenAICompatibleChat({ name: "openai", baseUrl: "https://x", apiKey: "k", timeoutMs: 50, fetch: mockFetch(stalled) });
    const seen: unknown[] = [];
    await expect(
      (async () => {
        for await (const c of p.stream({ ...req, model: "m" })) seen.push(c);
      })(),
    ).rejects.toThrow(/stalled/);
    expect(seen).toEqual([{ type: "text", text: "a" }]);
  });
});

describe("AnthropicChat (official SDK with mocked fetch)", () => {
  const anthropicSse = (events: { type: string; [k: string]: unknown }[]) =>
    new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), { status: 200, headers: { "content-type": "text/event-stream" } });

  it("streams text and reports usage", async () => {
    const f = mockFetch(
      anthropicSse([
        { type: "message_start", message: { id: "m1", type: "message", role: "assistant", model: "claude-haiku-5-5", content: [], stop_reason: null, usage: { input_tokens: 42, output_tokens: 1 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Ships " } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Monday [1]" } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 7 } },
        { type: "message_stop" },
      ]),
    );
    const p = new AnthropicChat({ apiKey: "k", timeoutMs: 5000, fetch: f });
    const out = await collect(p.stream({ ...req, model: "claude-haiku-5-5", temperature: 0.3 }));
    expect(out).toEqual([
      { type: "text", text: "Ships " },
      { type: "text", text: "Monday [1]" },
      { type: "usage", inputTokens: 42, outputTokens: 7 },
    ]);
    expect(f.calls[0]!.url).toContain("/v1/messages");
    expect(f.calls[0]!.headers.get("authorization")).toBe("Bearer k");
    expect(f.calls[0]!.body).toMatchObject({ model: "claude-haiku-5-5", system: "sys", stream: true, output_config: { effort: "low" } });
    expect(f.calls[0]!.body).not.toHaveProperty("temperature");
  });

  it("maps API errors to ProviderError", async () => {
    const p = new AnthropicChat({ apiKey: "k", timeoutMs: 5000, fetch: mockFetch(json(529, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } })) });
    await expect(collect(p.stream({ ...req, model: "claude-haiku-5-5" }))).rejects.toMatchObject({ provider: "anthropic", status: 529, retryable: true });
    const p400 = new AnthropicChat({ apiKey: "k", timeoutMs: 5000, fetch: mockFetch(json(400, { type: "error", error: { type: "invalid_request_error", message: "bad" } })) });
    await expect(collect(p400.stream({ ...req, model: "claude-haiku-5-5" }))).rejects.toMatchObject({ status: 400, retryable: false });
  });
});

/** Scripted provider: each call consumes the next behaviour. */
function scripted(name: "gemini" | "openai" | "anthropic", behaviours: ("ok" | "429" | "500" | "400" | "timeout" | "break")[]): ChatProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    name,
    calls,
    async *stream(r): AsyncGenerator<ChatChunk> {
      calls.push(r.model);
      const b = behaviours.shift() ?? "ok";
      if (b === "429") throw new ProviderError("rate limited", name, { status: 429, retryable: true, retryAfterMs: 1234 });
      if (b === "500") throw new ProviderError("server error", name, { status: 500, retryable: true });
      if (b === "400") throw new ProviderError("bad request", name, { status: 400, retryable: false });
      if (b === "timeout") throw new ProviderError("timed out", name, { retryable: true });
      yield { type: "text", text: `${name}:${r.model}` };
      if (b === "break") throw new ProviderError("connection reset", name, { retryable: true });
      yield { type: "usage", inputTokens: 1, outputTokens: 1 };
    },
  };
}

describe("streamWithFallback", () => {
  it("retries transient errors with backoff (honouring Retry-After) before succeeding", async () => {
    const g = scripted("gemini", ["429", "500", "ok"]);
    const sleep = vi.fn(noSleep);
    const out = await collect(streamWithFallback([{ provider: g, model: "gemini-2.5-flash" }], req, { maxRetries: 2, sleep, random: () => 1 }));
    expect(g.calls).toHaveLength(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 1234);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);
    expect(out[0]).toMatchObject({ type: "start", provider: "gemini", attempts: [{ status: 429 }, { status: 500 }] });
    expect(out[1]).toEqual({ type: "text", text: "gemini:gemini-2.5-flash" });
  });

  it("falls back to the next provider after exhausting retries", async () => {
    const g = scripted("gemini", ["500", "500"]);
    const o = scripted("openai", ["ok"]);
    const out = await collect(
      streamWithFallback(
        [
          { provider: g, model: "gemini-2.5-flash" },
          { provider: o, model: "gpt-4o-mini" },
        ],
        req,
        { maxRetries: 1, sleep: noSleep },
      ),
    );
    expect(g.calls).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: "start", provider: "openai", model: "gpt-4o-mini" });
  });

  it("skips straight to the next provider on non-retryable errors", async () => {
    const g = scripted("gemini", ["400"]);
    const a = scripted("anthropic", ["timeout", "ok"]);
    const sleep = vi.fn(noSleep);
    const out = await collect(
      streamWithFallback(
        [
          { provider: g, model: "gemini-2.5-flash" },
          { provider: a, model: "claude-haiku-5-5" },
        ],
        req,
        { maxRetries: 2, sleep },
      ),
    );
    expect(g.calls).toHaveLength(1);
    expect(a.calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(out[0]).toMatchObject({ provider: "anthropic" });
  });

  it("throws AllProvidersFailedError with every attempt recorded", async () => {
    const g = scripted("gemini", ["500", "500"]);
    const o = scripted("openai", ["400"]);
    const err = await collect(
      streamWithFallback(
        [
          { provider: g, model: "a" },
          { provider: o, model: "b" },
        ],
        req,
        { maxRetries: 1, sleep: noSleep },
      ),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(AllProvidersFailedError);
    expect((err as AllProvidersFailedError).attempts.map((a) => `${a.provider}:${a.status}`)).toEqual(["gemini:500", "gemini:500", "openai:400"]);
  });

  it("does not switch providers once tokens have been streamed", async () => {
    const g = scripted("gemini", ["break"]);
    const o = scripted("openai", ["ok"]);
    const seen: unknown[] = [];
    const err = await (async () => {
      for await (const c of streamWithFallback(
        [
          { provider: g, model: "a" },
          { provider: o, model: "b" },
        ] as Candidate[],
        req,
        { maxRetries: 2, sleep: noSleep },
      ))
        seen.push(c);
    })().catch((e) => e);
    expect(err).toBeInstanceOf(StreamInterruptedError);
    expect(seen).toHaveLength(2);
    expect(o.calls).toHaveLength(0);
  });

  it("computes capped exponential backoff with jitter", () => {
    const o = { baseDelayMs: 500, maxDelayMs: 8000 };
    expect(backoffDelay(0, { ...o, random: () => 0 })).toBe(250);
    expect(backoffDelay(3, { ...o, random: () => 1 })).toBe(4000);
    expect(backoffDelay(10, { ...o, random: () => 1 })).toBe(8000);
    expect(backoffDelay(0, { ...o, random: () => 1, retryAfterMs: 60_000 })).toBe(8000);
  });
});

describe("provider registry", () => {
  it("only includes providers with API keys and orders candidates bot-model-first", () => {
    const env = envSchema.parse({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" });
    const reg = buildRegistry(env);
    expect(reg.configured.sort()).toEqual(["anthropic", "gemini"]);
    expect(reg.embeddings?.model).toBe("gemini-embedding-001");
    const c = chatCandidates("claude-sonnet-5-5", reg, "gemini-3.5-flash-lite,gpt-4o-mini,claude-sonnet-5-5,unknown-model");
    expect(c.map((x) => x.model)).toEqual(["claude-sonnet-5-5", "gemini-3.5-flash-lite"]);
  });

  it("defaults embeddings to OpenAI when no Gemini key is configured", () => {
    const reg = buildRegistry(envSchema.parse({ OPENAI_API_KEY: "o" }));
    expect(reg.embeddings).toMatchObject({ name: "openai", model: "text-embedding-3-small", dimensions: 1536 });
  });
});

describe("OpenAICompatibleEmbeddings", () => {
  const vec = (n: number, v = 1) => Array.from({ length: n }, () => v);

  it("batches inputs, requests 1536 dimensions, normalises vectors and estimates missing usage", async () => {
    const f = mockFetch(
      json(200, { data: [{ index: 1, embedding: vec(1536, 2) }, { index: 0, embedding: vec(1536, 1) }] }),
      json(200, { data: [{ index: 0, embedding: vec(1536, 3) }] }),
    );
    const e = new OpenAICompatibleEmbeddings({ name: "gemini", baseUrl: "https://g/v1beta/openai/", apiKey: "k", model: "gemini-embedding-001", timeoutMs: 1000, maxRetries: 0, batchSize: 2, fetch: f });
    const res = await e.embed(["aaaa", "bbbbbbbb", "cccc"]);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]!.body).toEqual({ model: "gemini-embedding-001", input: ["aaaa", "bbbbbbbb"], dimensions: 1536 });
    expect(res.vectors).toHaveLength(3);
    const norm = Math.sqrt(res.vectors[0]!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
    expect(res.estimated).toBe(true);
    expect(res.inputTokens).toBe(1 + 2 + 1);
  });

  it("rejects vectors of the wrong dimension instead of corrupting the index", async () => {
    const e = new OpenAICompatibleEmbeddings({ name: "openai", baseUrl: "https://o", apiKey: "k", model: "x", timeoutMs: 1000, maxRetries: 3, fetch: mockFetch(json(200, { data: [{ index: 0, embedding: vec(3072) }] })) });
    await expect(e.embed(["a"])).rejects.toThrow(/3072-dim/);
  });

  it("retries 429 responses", async () => {
    const f = mockFetch(json(429, { error: { message: "quota" } }, { "retry-after": "0" }), json(200, { data: [{ index: 0, embedding: vec(1536) }], usage: { prompt_tokens: 5 } }));
    const e = new OpenAICompatibleEmbeddings({ name: "openai", baseUrl: "https://o", apiKey: "k", model: "x", timeoutMs: 1000, maxRetries: 2, fetch: f, sleep: noSleep });
    const res = await e.embed(["a"]);
    expect(f.calls).toHaveLength(2);
    expect(res).toMatchObject({ inputTokens: 5, estimated: false });
  });
});
