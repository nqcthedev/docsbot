import { z } from "zod";
import { CHAT_MODELS } from "./ai/models";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.email("Enter a valid email").trim().toLowerCase().max(254),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase().max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #4f46e5");
const chatModelId = z.string().refine((id) => CHAT_MODELS.some((m) => m.id === id), "Unknown model");

export const createBotSchema = z.object({
  name: z.string().trim().min(1, "Give your bot a name").max(60),
});

export const botSettingsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  welcomeMessage: z.string().trim().min(1).max(300),
  fallbackMessage: z.string().trim().min(1).max(300),
  brandColor: hexColor,
  instructions: z.string().trim().max(2000),
  chatModel: chatModelId,
  temperature: z.coerce.number().min(0).max(1),
  minSimilarity: z.coerce.number().min(0).max(0.95),
  topK: z.coerce.number().int().min(1).max(12),
  allowedDomains: z.string().max(2000),
  leadCaptureEnabled: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const websiteSourceSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: "Enter a full http(s) URL" }).max(2000),
  maxPages: z.coerce.number().int().min(1).max(1000).default(25),
});

export const textSourceSchema = z.object({
  name: z.string().trim().min(1, "Give it a title").max(120),
  text: z.string().trim().min(20, "Paste at least a few sentences").max(200_000),
});

export const chatRequestSchema = z.object({
  botId: z.uuid(),
  message: z.string().trim().min(1).max(20_000),
  conversationId: z.uuid().optional(),
  visitorId: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
  channel: z.enum(["widget", "playground"]).default("widget"),
  pageOrigin: z.string().max(300).optional(),
});

export const leadRequestSchema = z.object({
  botId: z.uuid(),
  conversationId: z.uuid().optional(),
  email: z.email("Enter a valid email").trim().toLowerCase().max(254),
  name: z.string().trim().max(120).optional(),
  question: z.string().trim().min(1).max(2000),
});

export type FieldErrors = Record<string, string | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
