import type { FieldErrors } from 'src/types/common';

import { z } from 'zod';

import {
  BOT_TOP_K_RANGE,
  PASSWORD_MIN_LENGTH,
  BOT_NAME_MAX_LENGTH,
  BOT_TEMPERATURE_RANGE,
  BOT_MESSAGE_MAX_LENGTH,
  DEFAULT_CRAWL_MAX_PAGES,
  BOT_INSTRUCTIONS_MAX_LENGTH,
} from 'src/shared/constants';

import { CHAT_MODELS } from './ai/models';

/** Ids of bots, sources and conversations (Postgres uuids) passed in URLs or bound to actions. */
export const entityIdSchema = z.guid();

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: z.email('Enter a valid email').trim().toLowerCase().max(254),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(128),
});

export const loginSchema = z.object({
  email: z.email('Enter a valid email').trim().toLowerCase().max(254),
  password: z.string().min(1, 'Enter your password').max(128),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color like #4f46e5');
const chatModelId = z
  .string()
  .refine((id) => CHAT_MODELS.some((m) => m.id === id), 'Unknown model');

export const createBotSchema = z.object({
  name: z.string().trim().min(1, 'Give your bot a name').max(BOT_NAME_MAX_LENGTH),
});

export const botSettingsSchema = z.object({
  name: z.string().trim().min(1).max(BOT_NAME_MAX_LENGTH),
  welcomeMessage: z.string().trim().min(1).max(BOT_MESSAGE_MAX_LENGTH),
  fallbackMessage: z.string().trim().min(1).max(BOT_MESSAGE_MAX_LENGTH),
  brandColor: hexColor,
  instructions: z.string().trim().max(BOT_INSTRUCTIONS_MAX_LENGTH),
  chatModel: chatModelId,
  temperature: z.coerce.number().min(BOT_TEMPERATURE_RANGE.min).max(BOT_TEMPERATURE_RANGE.max),
  minSimilarity: z.coerce.number().min(0).max(0.95),
  topK: z.coerce.number().int().min(BOT_TOP_K_RANGE.min).max(BOT_TOP_K_RANGE.max),
  allowedDomains: z.string().max(2000),
  leadCaptureEnabled: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export const websiteSourceSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: 'Enter a full http(s) URL' }).max(2000),
  maxPages: z.coerce.number().int().min(1).max(1000).default(DEFAULT_CRAWL_MAX_PAGES),
});

export const textSourceSchema = z.object({
  name: z.string().trim().min(1, 'Give it a title').max(120),
  text: z.string().trim().min(20, 'Paste at least a few sentences').max(200_000),
});

export const chatRequestSchema = z.object({
  botId: z.uuid(),
  message: z.string().trim().min(1).max(20_000),
  conversationId: z.uuid().optional(),
  visitorId: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
  channel: z.enum(['widget', 'playground']).default('widget'),
  pageOrigin: z.string().max(300).optional(),
});

export const leadRequestSchema = z.object({
  botId: z.uuid(),
  conversationId: z.uuid().optional(),
  email: z.email('Enter a valid email').trim().toLowerCase().max(254),
  name: z.string().trim().max(120).optional(),
  question: z.string().trim().min(1).max(2000),
});

export type BotSettingsInput = z.infer<typeof botSettingsSchema>;

/** First message per field; issues without a path (whole-object refinements) go to `form`. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}
