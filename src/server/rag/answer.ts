import type { Database } from 'src/server/db';
import type { Logger } from 'src/server/logger';
import type { ChatMessage } from 'src/server/ai/types';
import type { Bot, Citation } from 'src/server/db/schema';
import type { FallbackOptions } from 'src/server/ai/fallback';
import type { ProviderRegistry } from 'src/server/ai/registry';

import { eq, sql } from 'drizzle-orm';

import { estimateTokens } from 'src/server/ai/types';
import { chatCandidates } from 'src/server/ai/registry';
import { messages, usageEvents, conversations } from 'src/server/db/schema';
import { estimateChatCost, estimateEmbeddingCost } from 'src/server/ai/models';
import {
  streamWithFallback,
  StreamInterruptedError,
  AllProvidersFailedError,
} from 'src/server/ai/fallback';

import { retrieve } from './retrieve';
import {
  AnswerGate,
  wantsHuman,
  buildMessages,
  containsNoAnswer,
  extractCitations,
  retrievalQueries,
  buildSystemPrompt,
  sanitizeCitations,
} from './prompt';

export type Outcome =
  'answered' | 'low_confidence' | 'no_answer' | 'handoff' | 'error' | 'not_indexed';

export type AnswerEvent =
  | { type: 'start'; provider: string | null; model: string | null }
  | { type: 'token'; text: string }
  | {
      type: 'done';
      messageId: string;
      answered: boolean;
      outcome: Outcome;
      citations: Citation[];
      offerLead: boolean;
      /** Present when the streamed text must be replaced (e.g. the model emitted NO_ANSWER mid-way). */
      replaceWith?: string;
      confidence: number | null;
    };

export type AnswerParams = {
  db: Database;
  registry: ProviderRegistry;
  bot: Bot;
  conversationId: string;
  question: string;
  history: ChatMessage[];
  emit: (e: AnswerEvent) => void | Promise<void>;
  logger: Logger;
  signal?: AbortSignal;
  fallbackOptions: Omit<FallbackOptions, 'logger'>;
  fallbackModels?: string;
};

export const HANDOFF_MESSAGE =
  'Of course. Leave your email and question below and someone from the team will get back to you.';
export const ERROR_MESSAGE =
  "Sorry, I'm having trouble answering right now. Please try again in a moment.";
export const NOT_INDEXED_MESSAGE = "This assistant hasn't been trained on any content yet.";

/**
 * Retrieval-augmented answer with streaming, provider fallback, confidence gating and
 * citation extraction. Persists the assistant message and usage; never throws for
 * provider failures (the visitor gets a graceful message instead).
 */
export async function answerQuestion(
  p: AnswerParams
): Promise<{ messageId: string; outcome: Outcome; text: string; citations: Citation[] }> {
  const { db, bot, registry: reg, logger } = p;
  const started = Date.now();
  const log = logger.child({ botId: bot.id, conversationId: p.conversationId });
  const humanRequested = wantsHuman(p.question);

  let outcome: Outcome = 'answered';
  let text = '';
  let citations: Citation[] = [];
  let confidence: number | null = null;
  let provider: string | null = null;
  let model: string | null = null;
  let usage = { inputTokens: 0, outputTokens: 0, estimated: false };
  let replaceWith: string | undefined;

  const say = async (message: string, o: Outcome) => {
    outcome = o;
    text = message;
    await p.emit({ type: 'start', provider: null, model: null });
    await p.emit({ type: 'token', text: message });
  };

  const embeddings = reg.embeddings;
  if (!embeddings) {
    log.error('no embedding provider configured');
    await say(ERROR_MESSAGE, 'error');
  } else if (!bot.embeddingModel) {
    await say(NOT_INDEXED_MESSAGE, 'not_indexed');
  } else {
    let ctx: Awaited<ReturnType<typeof retrieve>> | undefined;
    try {
      const queries = retrievalQueries(p.question, p.history);
      const emb = await embeddings.embed(queries, p.signal);
      await db.insert(usageEvents).values({
        botId: bot.id,
        kind: 'embedding',
        provider: embeddings.name,
        model: embeddings.model,
        inputTokens: Math.round(emb.inputTokens),
        estimated: emb.estimated,
        costUsd: estimateEmbeddingCost(embeddings.model, emb.inputTokens),
      });
      ctx = await retrieve(db, {
        botId: bot.id,
        embeddingModel: embeddings.model,
        queryVectors: emb.vectors,
        queryText: queries.at(-1)!,
        topK: bot.topK,
        minSimilarity: bot.minSimilarity,
      });
      confidence = ctx.confidence.topSimilarity;
    } catch (err) {
      log.error('retrieval failed', { err });
      await say(ERROR_MESSAGE, 'error');
    }

    if (ctx && !ctx.confidence.confident) {
      log.info('low retrieval confidence', {
        topSimilarity: confidence,
        threshold: bot.minSimilarity,
      });
      await say(
        humanRequested ? HANDOFF_MESSAGE : bot.fallbackMessage,
        humanRequested ? 'handoff' : 'low_confidence'
      );
    } else if (ctx) {
      const contexts = ctx.chunks;
      const system = buildSystemPrompt(bot, contexts);
      const chatMessages = buildMessages(p.history, p.question);
      const gate = new AnswerGate();
      let raw = '';
      try {
        const stream = streamWithFallback(
          chatCandidates(bot.chatModel, reg, p.fallbackModels),
          {
            system,
            messages: chatMessages,
            temperature: bot.temperature,
            maxOutputTokens: 700,
            signal: p.signal,
          },
          { ...p.fallbackOptions, logger: log }
        );
        for await (const chunk of stream) {
          if (chunk.type === 'start') {
            provider = chunk.provider;
            model = chunk.model;
            await p.emit({ type: 'start', provider, model });
          } else if (chunk.type === 'text') {
            raw += chunk.text;
            const out = gate.push(chunk.text);
            if (out) await p.emit({ type: 'token', text: out });
          } else if (chunk.type === 'usage') {
            usage = {
              inputTokens: chunk.inputTokens,
              outputTokens: chunk.outputTokens,
              estimated: false,
            };
          }
        }
        const rest = gate.flush();
        if (rest) await p.emit({ type: 'token', text: rest });
        if (!usage.inputTokens)
          usage = {
            inputTokens: estimateTokens(system + JSON.stringify(chatMessages)),
            outputTokens: estimateTokens(raw),
            estimated: true,
          };

        if (gate.noAnswer || containsNoAnswer(raw)) {
          outcome = humanRequested ? 'handoff' : 'no_answer';
          text = humanRequested ? HANDOFF_MESSAGE : bot.fallbackMessage;
          if (!gate.noAnswer)
            replaceWith = text; // part of an answer was already streamed
          else await p.emit({ type: 'token', text });
        } else {
          text = sanitizeCitations(raw.trim(), contexts.length);
          citations = extractCitations(text, contexts);
          if (text !== raw.trim()) replaceWith = text;
        }
      } catch (err) {
        if (err instanceof AllProvidersFailedError)
          log.error('all providers failed', { attempts: err.attempts });
        else if (err instanceof StreamInterruptedError)
          log.error('stream interrupted', { err: err.cause });
        else log.error('answer generation failed', { err });
        outcome = 'error';
        text = raw.trim() ? `${raw.trim()}\n\n(${ERROR_MESSAGE})` : ERROR_MESSAGE;
        if (raw.trim()) replaceWith = text;
        else await p.emit({ type: 'token', text });
      }
    }
  }

  const finalOutcome = outcome as Outcome; // assigned inside closures; widen for the checks below
  const answered = finalOutcome === 'answered';
  const latencyMs = Date.now() - started;
  const [saved] = await db
    .insert(messages)
    .values({
      conversationId: p.conversationId,
      botId: bot.id,
      role: 'assistant',
      content: text,
      citations,
      answered,
      outcome,
      confidence,
      provider,
      model,
      inputTokens: usage.inputTokens || null,
      outputTokens: usage.outputTokens || null,
      latencyMs,
    })
    .returning({ id: messages.id });
  await db
    .update(conversations)
    .set({ messageCount: sql`${conversations.messageCount} + 1`, lastMessageAt: new Date() })
    .where(eq(conversations.id, p.conversationId));
  if (provider && model && (usage.inputTokens || usage.outputTokens)) {
    await db.insert(usageEvents).values({
      botId: bot.id,
      kind: 'chat',
      provider,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimated: usage.estimated,
      costUsd: estimateChatCost(model, usage.inputTokens, usage.outputTokens),
    });
  }

  const offerLead =
    bot.leadCaptureEnabled &&
    (humanRequested || (finalOutcome !== 'answered' && finalOutcome !== 'not_indexed'));
  await p.emit({
    type: 'done',
    messageId: saved!.id,
    answered,
    outcome,
    citations,
    offerLead,
    replaceWith,
    confidence,
  });
  log.info('answered', {
    outcome,
    provider,
    model,
    confidence,
    latencyMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  });
  return { messageId: saved!.id, outcome, text, citations };
}
