import type { ChatChunk, FetchLike, ChatRequest, ChatProvider, ProviderName } from './types';

import { readSse } from 'src/shared/sse';

import { ProviderError } from './types';
import { networkError, toProviderError, withIdleTimeout } from './http';

export type OpenAICompatibleOptions = {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetch?: FetchLike;
  /** Extra request-body fields per model, e.g. `{ reasoning_effort: "none" }` for Gemini 2.5 Flash. */
  modelParams?: (model: string) => Record<string, unknown> | undefined;
};

type StreamChunk = {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  error?: { message?: string };
};

export function joinUrl(base: string, path: string) {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

/**
 * Chat Completions client that works with OpenAI and with Google's OpenAI-compatible
 * Gemini endpoint (and any other compatible gateway, e.g. OpenRouter, Together, vLLM).
 */
export class OpenAICompatibleChat implements ChatProvider {
  readonly name: ProviderName;
  constructor(private readonly opts: OpenAICompatibleOptions) {
    this.name = opts.name;
  }

  async *stream(req: ChatRequest): AsyncGenerator<ChatChunk> {
    const f = this.opts.fetch ?? fetch;
    const body = {
      model: req.model,
      stream: true,
      stream_options: { include_usage: true },
      temperature: req.temperature,
      max_tokens: req.maxOutputTokens,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
      ...this.opts.modelParams?.(req.model),
    };
    // The connect/first-byte timeout covers the request; the idle timeout below covers the stream.
    const abort = new AbortController();
    const signal = req.signal ? AbortSignal.any([req.signal, abort.signal]) : abort.signal;
    const firstByteTimer = setTimeout(
      () => abort.abort(new DOMException('first byte timeout', 'TimeoutError')),
      this.opts.timeoutMs
    );
    let res: Response;
    try {
      res = await f(joinUrl(this.opts.baseUrl, 'chat/completions'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      throw networkError(this.name, err);
    } finally {
      clearTimeout(firstByteTimer);
    }
    if (!res.ok || !res.body) throw await toProviderError(this.name, res);

    let usage: { inputTokens: number; outputTokens: number } | undefined;
    try {
      for await (const ev of withIdleTimeout(
        readSse(res.body),
        this.opts.timeoutMs,
        this.name,
        () => abort.abort()
      )) {
        if (ev.data === '[DONE]') break;
        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(ev.data) as StreamChunk;
        } catch {
          continue;
        }
        if (chunk.error)
          throw new ProviderError(`${this.name} stream error: ${chunk.error.message}`, this.name, {
            retryable: true,
          });
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield { type: 'text', text };
        // OpenAI sends usage once at the end; Gemini sends a cumulative value on every chunk.
        if (chunk.usage)
          usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          };
      }
    } catch (err) {
      throw networkError(this.name, err);
    }
    if (usage) yield { type: 'usage', ...usage };
  }
}
