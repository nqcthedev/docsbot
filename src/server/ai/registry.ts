import type { Env } from 'src/server/env';
import type { Candidate } from './fallback';
import type { FetchLike, ChatProvider, ProviderName, EmbeddingProvider } from './types';

import { env } from 'src/server/env';

import { AnthropicChat } from './anthropic';
import { OpenAICompatibleEmbeddings } from './embeddings';
import { OpenAICompatibleChat } from './openai-compatible';
import { CHAT_MODELS, chatModelInfo, DEFAULT_EMBEDDING_MODEL } from './models';

export type ProviderRegistry = {
  chat: Partial<Record<ProviderName, ChatProvider>>;
  embeddings: EmbeddingProvider | undefined;
  configured: ProviderName[];
};

const modelParams = (model: string) => chatModelInfo(model)?.params;

export function buildRegistry(e: Env = env(), fetchImpl?: FetchLike): ProviderRegistry {
  const chat: ProviderRegistry['chat'] = {};
  if (e.GEMINI_API_KEY)
    chat.gemini = new OpenAICompatibleChat({
      name: 'gemini',
      baseUrl: e.GEMINI_BASE_URL,
      apiKey: e.GEMINI_API_KEY,
      timeoutMs: e.AI_TIMEOUT_MS,
      fetch: fetchImpl,
      modelParams,
    });
  if (e.OPENAI_API_KEY)
    chat.openai = new OpenAICompatibleChat({
      name: 'openai',
      baseUrl: e.OPENAI_BASE_URL,
      apiKey: e.OPENAI_API_KEY,
      timeoutMs: e.AI_TIMEOUT_MS,
      fetch: fetchImpl,
      modelParams,
    });
  if (e.ANTHROPIC_API_KEY)
    chat.anthropic = new AnthropicChat({
      apiKey: e.ANTHROPIC_API_KEY,
      baseUrl: e.ANTHROPIC_BASE_URL,
      timeoutMs: e.AI_TIMEOUT_MS,
      fetch: fetchImpl,
    });

  let embeddings: EmbeddingProvider | undefined;
  const provider = e.EMBEDDING_PROVIDER;
  const key = provider === 'gemini' ? e.GEMINI_API_KEY : e.OPENAI_API_KEY;
  if (key) {
    embeddings = new OpenAICompatibleEmbeddings({
      name: provider,
      baseUrl: provider === 'gemini' ? e.GEMINI_BASE_URL : e.OPENAI_BASE_URL,
      apiKey: key,
      model: e.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL[provider],
      timeoutMs: e.AI_TIMEOUT_MS,
      maxRetries: Math.max(e.AI_MAX_RETRIES, 3),
      fetch: fetchImpl,
    });
  }
  return { chat, embeddings, configured: Object.keys(chat) as ProviderName[] };
}

let cached: ProviderRegistry | undefined;
export function registry(): ProviderRegistry {
  return (cached ??= buildRegistry());
}
export function setRegistryForTesting(r: ProviderRegistry | undefined) {
  cached = r;
}

/** Bot model first, then the configured fallback chain; models whose provider has no API key are skipped. */
export function chatCandidates(
  primaryModel: string,
  reg: ProviderRegistry = registry(),
  fallbackList = env().CHAT_FALLBACK_MODELS
): Candidate[] {
  const ids = [primaryModel, ...fallbackList.split(',').map((s) => s.trim())].filter(Boolean);
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const info = chatModelInfo(id);
    if (!info) continue;
    const provider = reg.chat[info.provider];
    if (provider) out.push({ provider, model: id });
  }
  return out;
}

export function availableChatModels(reg: ProviderRegistry = registry()) {
  return CHAT_MODELS.map((m) => ({ ...m, available: Boolean(reg.chat[m.provider]) }));
}
