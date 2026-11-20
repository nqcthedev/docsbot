export type ProviderName = "gemini" | "openai" | "anthropic";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  model: string;
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

export type ChatChunk = { type: "text"; text: string } | { type: "usage"; inputTokens: number; outputTokens: number };

export interface ChatProvider {
  readonly name: ProviderName;
  /**
   * Streams a completion. Implementations MUST throw a ProviderError (before yielding
   * anything) when the request is rejected, so the fallback layer can retry or switch provider.
   */
  stream(req: ChatRequest): AsyncGenerator<ChatChunk>;
}

export type EmbeddingResult = { vectors: number[][]; inputTokens: number; estimated: boolean };

export interface EmbeddingProvider {
  readonly name: ProviderName;
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[], signal?: AbortSignal): Promise<EmbeddingResult>;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderName,
    public readonly opts: { status?: number; retryable: boolean; retryAfterMs?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "ProviderError";
  }
  get status() {
    return this.opts.status;
  }
  get retryable() {
    return this.opts.retryable;
  }
  get retryAfterMs() {
    return this.opts.retryAfterMs;
  }
}

/** 408 / 409 / 425 / 429 and 5xx are transient; other 4xx are configuration or request errors. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export function parseRetryAfter(header: string | null | undefined): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
