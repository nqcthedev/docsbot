import { EMBEDDING_DIMENSIONS } from "../db/schema";
import { backoffDelay } from "./fallback";
import { networkError, timeoutSignal, toProviderError } from "./http";
import { joinUrl } from "./openai-compatible";
import { ProviderError, estimateTokens, type EmbeddingProvider, type EmbeddingResult, type FetchLike, type ProviderName } from "./types";

export type OpenAICompatibleEmbeddingOptions = {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  batchSize?: number;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
};

export function l2normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

/**
 * /v1/embeddings client (OpenAI and Gemini's OpenAI-compatible endpoint). Always requests
 * EMBEDDING_DIMENSIONS and verifies the returned width, so a model that ignores `dimensions`
 * fails loudly instead of corrupting the index.
 */
export class OpenAICompatibleEmbeddings implements EmbeddingProvider {
  readonly name: ProviderName;
  readonly model: string;
  readonly dimensions = EMBEDDING_DIMENSIONS;

  constructor(private readonly opts: OpenAICompatibleEmbeddingOptions) {
    this.name = opts.name;
    this.model = opts.model;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<EmbeddingResult> {
    const batchSize = this.opts.batchSize ?? 64;
    const vectors: number[][] = [];
    let inputTokens = 0;
    let estimated = false;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const res = await this.embedBatch(batch, signal);
      vectors.push(...res.vectors);
      inputTokens += res.inputTokens;
      estimated ||= res.estimated;
    }
    return { vectors, inputTokens, estimated };
  }

  private async embedBatch(input: string[], signal?: AbortSignal): Promise<EmbeddingResult> {
    const f = this.opts.fetch ?? fetch;
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let lastErr: ProviderError | undefined;
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      try {
        let res: Response;
        try {
          res = await f(joinUrl(this.opts.baseUrl, "embeddings"), {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${this.opts.apiKey}` },
            body: JSON.stringify({ model: this.model, input, dimensions: this.dimensions }),
            signal: timeoutSignal(this.opts.timeoutMs, signal),
          });
        } catch (err) {
          throw networkError(this.name, err);
        }
        if (!res.ok) throw await toProviderError(this.name, res);
        const json = (await res.json()) as { data?: { embedding: number[]; index?: number }[]; usage?: { prompt_tokens?: number } };
        const data = [...(json.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
        if (data.length !== input.length) throw new ProviderError(`${this.name} returned ${data.length} embeddings for ${input.length} inputs`, this.name, { retryable: false });
        const vectors = data.map((d) => {
          if (d.embedding.length !== this.dimensions)
            throw new ProviderError(
              `${this.name}/${this.model} returned ${d.embedding.length}-dim vectors, expected ${this.dimensions}. Choose a model that supports the 'dimensions' parameter.`,
              this.name,
              { retryable: false },
            );
          return l2normalize(d.embedding);
        });
        const reported = json.usage?.prompt_tokens;
        return {
          vectors,
          inputTokens: reported ?? input.reduce((n, t) => n + estimateTokens(t), 0),
          estimated: reported === undefined,
        };
      } catch (err) {
        lastErr = err instanceof ProviderError ? err : networkError(this.name, err);
        if (!lastErr.retryable || attempt === this.opts.maxRetries) throw lastErr;
        await sleep(backoffDelay(attempt, { baseDelayMs: 1000, maxDelayMs: 15_000, random: Math.random, retryAfterMs: lastErr.retryAfterMs }));
      }
    }
    throw lastErr ?? new ProviderError("embedding failed", this.name, { retryable: false });
  }
}
