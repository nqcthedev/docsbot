import type { ProviderName } from './types';

import { ProviderError, parseRetryAfter, isRetryableStatus } from './types';

/** Turns a fetch failure or non-2xx response into a classified ProviderError. */
export async function toProviderError(
  provider: ProviderName,
  res: Response
): Promise<ProviderError> {
  let detail = '';
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as unknown;
      const obj = (Array.isArray(json) ? json[0] : json) as
        { error?: { message?: string } } | undefined;
      detail = obj?.error?.message ?? text;
    } catch {
      detail = text;
    }
  } catch {
    /* ignore */
  }
  return new ProviderError(
    `${provider} responded ${res.status}: ${detail.slice(0, 300)}`,
    provider,
    {
      status: res.status,
      retryable: isRetryableStatus(res.status),
      retryAfterMs: parseRetryAfter(res.headers.get('retry-after')),
    }
  );
}

export function networkError(provider: ProviderName, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  const name = (err as { name?: string })?.name;
  const isTimeout = name === 'TimeoutError' || name === 'AbortError';
  return new ProviderError(
    isTimeout
      ? `${provider} request timed out`
      : `${provider} network error: ${(err as Error)?.message ?? String(err)}`,
    provider,
    { retryable: true, cause: err }
  );
}

/** Combines a caller signal with a timeout. */
export function timeoutSignal(ms: number, parent?: AbortSignal): AbortSignal {
  const t = AbortSignal.timeout(ms);
  return parent ? AbortSignal.any([parent, t]) : t;
}

/**
 * Wraps an async iterator so that a stalled stream (no chunk for `ms`) fails with a
 * retryable timeout instead of hanging the request forever.
 */
export async function* withIdleTimeout<T>(
  source: AsyncIterable<T>,
  ms: number,
  provider: ProviderName,
  onTimeout?: () => void
): AsyncGenerator<T> {
  const it = source[Symbol.asyncIterator]();
  let clean = false;
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.();
          reject(
            new ProviderError(`${provider} stream stalled for ${ms}ms`, provider, {
              retryable: true,
            })
          );
        }, ms);
      });
      let r: IteratorResult<T>;
      try {
        r = await Promise.race([it.next(), timeout]);
      } finally {
        clearTimeout(timer);
      }
      if (r.done) {
        clean = true;
        return;
      }
      yield r.value;
    }
  } finally {
    // A stalled source is still blocked inside next(): awaiting return() would hang forever.
    if (clean) await it.return?.();
    else void it.return?.()?.catch(() => {});
  }
}
