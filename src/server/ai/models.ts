import type { ProviderName } from "./types";

/**
 * Catalog of selectable chat models with list prices in USD per 1M tokens.
 * Prices are used for *estimated* cost reporting only — verify against your provider's
 * pricing page and adjust here. Entries marked `priceAssumed` have no published price we
 * could verify at the time of writing.
 */
export type ChatModelInfo = {
  id: string;
  provider: ProviderName;
  label: string;
  inputPerM: number;
  outputPerM: number;
  priceAssumed?: boolean;
  /** Extra OpenAI-compatible body params. */
  params?: Record<string, unknown>;
};

export const CHAT_MODELS: ChatModelInfo[] = [
  { id: "gemini-2.5-flash", provider: "gemini", label: "Gemini 2.5 Flash", inputPerM: 0.3, outputPerM: 2.5, params: { reasoning_effort: "none" } },
  { id: "gemini-3.5-flash-lite", provider: "gemini", label: "Gemini 3.5 Flash-Lite", inputPerM: 0.1, outputPerM: 0.4, priceAssumed: true, params: { reasoning_effort: "low" } },
  { id: "gemini-2.5-pro", provider: "gemini", label: "Gemini 2.5 Pro", inputPerM: 1.25, outputPerM: 10 },
  { id: "gpt-4o-mini", provider: "openai", label: "GPT-4o mini", inputPerM: 0.15, outputPerM: 0.6 },
  { id: "gpt-4.1-mini", provider: "openai", label: "GPT-4.1 mini", inputPerM: 0.4, outputPerM: 1.6 },
  { id: "gpt-4.1", provider: "openai", label: "GPT-4.1", inputPerM: 2, outputPerM: 8 },
  { id: "claude-haiku-5-5", provider: "anthropic", label: "Claude Haiku 5.5", inputPerM: 0.1, outputPerM: 0.5 },
  { id: "claude-sonnet-5-5", provider: "anthropic", label: "Claude Sonnet 5.5", inputPerM: 2, outputPerM: 10 },
  { id: "claude-opus-5-5", provider: "anthropic", label: "Claude Opus 5.5", inputPerM: 4, outputPerM: 20 },
];

export type EmbeddingModelInfo = { id: string; provider: "gemini" | "openai"; inputPerM: number };

export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
  { id: "gemini-embedding-001", provider: "gemini", inputPerM: 0.15 },
  { id: "text-embedding-3-small", provider: "openai", inputPerM: 0.02 },
  { id: "text-embedding-3-large", provider: "openai", inputPerM: 0.13 },
];

export const DEFAULT_EMBEDDING_MODEL: Record<"gemini" | "openai", string> = {
  gemini: "gemini-embedding-001",
  openai: "text-embedding-3-small",
};

export function chatModelInfo(id: string): ChatModelInfo | undefined {
  return CHAT_MODELS.find((m) => m.id === id);
}

export function estimateChatCost(model: string, inputTokens: number, outputTokens: number): number {
  const info = chatModelInfo(model);
  if (!info) return 0;
  return (inputTokens * info.inputPerM + outputTokens * info.outputPerM) / 1_000_000;
}

export function estimateEmbeddingCost(model: string, tokens: number): number {
  const info = EMBEDDING_MODELS.find((m) => m.id === model);
  return info ? (tokens * info.inputPerM) / 1_000_000 : 0;
}
