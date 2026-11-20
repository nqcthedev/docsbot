import type { ChatChunk, FetchLike, ChatRequest, ChatProvider } from './types';

import Anthropic from '@anthropic-ai/sdk';

import { withIdleTimeout } from './http';
import { ProviderError, isRetryableStatus } from './types';

export type AnthropicOptions = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
  fetch?: FetchLike;
};

/** Claude via the official Anthropic SDK (Messages API, streaming). Retries are handled by our fallback layer. */
export class AnthropicChat implements ChatProvider {
  readonly name = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(private readonly opts: AnthropicOptions) {
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl,
      maxRetries: 0,
      timeout: opts.timeoutMs,
      ...(opts.fetch ? { fetch: opts.fetch as never } : {}),
    });
  }

  async *stream(req: ChatRequest): AsyncGenerator<ChatChunk> {
    try {
      const stream = this.client.messages.stream(
        {
          model: req.model,
          max_tokens: req.maxOutputTokens ?? 1024,
          system: req.system,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          // Current Claude models reject custom sampling parameters; a short grounded answer needs little thinking.
          output_config: { effort: 'low' },
        },
        { signal: req.signal }
      );
      for await (const ev of withIdleTimeout(stream, this.opts.timeoutMs, this.name)) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta')
          yield { type: 'text', text: ev.delta.text };
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal')
        throw new ProviderError('anthropic refused the request', this.name, { retryable: false });
      yield {
        type: 'usage',
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
      };
    } catch (err) {
      throw toProviderError(err);
    }
  }
}

function toProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError)
    return new ProviderError('anthropic request timed out', 'anthropic', {
      retryable: true,
      cause: err,
    });
  if (err instanceof Anthropic.APIConnectionError)
    return new ProviderError(`anthropic network error: ${err.message}`, 'anthropic', {
      retryable: true,
      cause: err,
    });
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 500;
    const retryAfter = err.headers?.get?.('retry-after');
    return new ProviderError(
      `anthropic responded ${status}: ${err.message.slice(0, 300)}`,
      'anthropic',
      {
        status,
        retryable: isRetryableStatus(status),
        retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : undefined,
        cause: err,
      }
    );
  }
  return new ProviderError(
    `anthropic error: ${(err as Error)?.message ?? String(err)}`,
    'anthropic',
    { retryable: true, cause: err }
  );
}
