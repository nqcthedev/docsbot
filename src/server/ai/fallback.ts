import type { Logger } from "../logger";
import { ProviderError, type ChatChunk, type ChatProvider, type ChatRequest } from "./types";

export type Candidate = { provider: ChatProvider; model: string };

export type AttemptRecord = { provider: string; model: string; attempt: number; error: string; status?: number; retryable: boolean };

export type FallbackOptions = {
  maxRetries: number;
  /** Base delay for exponential backoff (ms). */
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  logger?: Logger;
  /** Circuit breaker store; defaults to a process-wide map. */
  cooldowns?: Map<string, number>;
  now?: () => number;
  /** How long a rate-limited model is skipped when the provider sends no Retry-After. */
  cooldownMs?: number;
};

const globalCooldowns = new Map<string, number>();

export type FallbackChunk = ChatChunk | { type: "start"; provider: string; model: string; attempts: AttemptRecord[] };

export class AllProvidersFailedError extends Error {
  constructor(public readonly attempts: AttemptRecord[]) {
    super(`All AI providers failed: ${attempts.map((a) => `${a.provider}/${a.model}: ${a.error}`).join("; ")}`);
    this.name = "AllProvidersFailedError";
  }
}

/** Error raised after the first token was already streamed: switching provider mid-answer is not possible. */
export class StreamInterruptedError extends Error {
  constructor(public override readonly cause: unknown) {
    super(`Stream interrupted: ${(cause as Error)?.message ?? String(cause)}`);
    this.name = "StreamInterruptedError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function backoffDelay(attempt: number, opts: { baseDelayMs: number; maxDelayMs: number; random: () => number; retryAfterMs?: number }) {
  if (opts.retryAfterMs !== undefined) return Math.min(opts.retryAfterMs, opts.maxDelayMs);
  const exp = opts.baseDelayMs * 2 ** attempt;
  // "Full jitter" between 50% and 100% of the exponential delay.
  return Math.min(opts.maxDelayMs, Math.round(exp * (0.5 + opts.random() * 0.5)));
}

/**
 * Streams from the first candidate that succeeds. Each candidate is retried with
 * exponential backoff on transient failures (429, 5xx, timeouts, network); non-retryable
 * errors (400/401/403/404) move straight to the next candidate. Once the first chunk has
 * been yielded the answer is committed to that provider.
 */
export async function* streamWithFallback(candidates: Candidate[], request: Omit<ChatRequest, "model">, options: FallbackOptions): AsyncGenerator<FallbackChunk> {
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 8_000;
  const attempts: AttemptRecord[] = [];
  const cooldowns = options.cooldowns ?? globalCooldowns;
  const now = options.now ?? Date.now;

  if (candidates.length === 0) throw new AllProvidersFailedError([]);

  for (const [index, { provider, model }] of candidates.entries()) {
    // Circuit breaker: a model that just exhausted its retries on 429s is skipped for a while,
    // so every visitor doesn't pay the retry latency. The last candidate is always attempted.
    const key = `${provider.name}:${model}`;
    const until = cooldowns.get(key);
    if (until && until > now() && index < candidates.length - 1) {
      attempts.push({ provider: provider.name, model, attempt: 0, error: "skipped: cooling down after rate limit", retryable: true });
      continue;
    }
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      if (request.signal?.aborted) throw request.signal.reason ?? new Error("aborted");
      const it = provider.stream({ ...request, model });
      let first: IteratorResult<ChatChunk>;
      try {
        first = await it.next();
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError(String((err as Error)?.message ?? err), provider.name, { retryable: true });
        attempts.push({ provider: provider.name, model, attempt, error: pe.message, status: pe.status, retryable: pe.retryable });
        options.logger?.warn("ai provider attempt failed", { provider: provider.name, model, attempt, status: pe.status, retryable: pe.retryable, error: pe.message });
        if (!pe.retryable || attempt === options.maxRetries) {
          if (pe.status === 429) cooldowns.set(key, now() + Math.min(pe.retryAfterMs ?? options.cooldownMs ?? 60_000, 10 * 60_000));
          break;
        }
        await sleep(backoffDelay(attempt, { baseDelayMs, maxDelayMs, random, retryAfterMs: pe.retryAfterMs }));
        continue;
      }

      cooldowns.delete(key);
      yield { type: "start", provider: provider.name, model, attempts };
      if (first.done) return;
      yield first.value;
      try {
        while (true) {
          const r = await it.next();
          if (r.done) return;
          yield r.value;
        }
      } catch (err) {
        throw new StreamInterruptedError(err);
      }
    }
  }
  throw new AllProvidersFailedError(attempts);
}
