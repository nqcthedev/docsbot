'use server';

import type { FieldErrors } from 'src/server/validation';

import { after } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { env } from 'src/server/env';
import { getDb } from 'src/server/db';
import { logger } from 'src/server/logger';
import { chatModelInfo } from 'src/server/ai/models';
import { bots, sources } from 'src/server/db/schema';
import { parseDomainList } from 'src/server/domains';
import { requireBot, requireUser } from 'src/server/data';
import { drainIngestQueue } from 'src/server/ingest/queue';
import { availableChatModels } from 'src/server/ai/registry';
import { BlockedUrlError, assertCrawlableUrl } from 'src/server/ingest/url-guard';
import {
  fieldErrors,
  createBotSchema,
  textSourceSchema,
  botSettingsSchema,
  websiteSourceSchema,
} from 'src/server/validation';

export type ActionState = { ok?: boolean; message?: string; errors?: FieldErrors } | undefined;

/** Kick the ingestion queue after the response is sent (works on Node servers and Vercel functions). */
function scheduleIngestion() {
  after(async () => {
    await drainIngestQueue();
  });
}

function defaultChatModel(): string {
  const models = availableChatModels();
  const preferred = env().DEFAULT_CHAT_MODEL;
  if (models.find((m) => m.id === preferred && m.available)) return preferred;
  return models.find((m) => m.available)?.id ?? preferred;
}

export async function createBot(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createBotSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const db = await getDb();
  const [bot] = await db
    .insert(bots)
    .values({
      workspaceId: user.workspaceId,
      name: parsed.data.name,
      chatModel: defaultChatModel(),
    })
    .returning({ id: bots.id });
  logger.info('bot created', { botId: bot!.id, userId: user.id });
  redirect(`/dashboard/bots/${bot!.id}/sources`);
}

export async function updateBotSettings(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireBot(botId);
  const parsed = botSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const { domains, invalid } = parseDomainList(parsed.data.allowedDomains);
  if (invalid.length)
    return { errors: { allowedDomains: `Not a valid domain: ${invalid.join(', ')}` } };
  const info = chatModelInfo(parsed.data.chatModel);
  if (!availableChatModels().find((m) => m.id === info?.id)?.available) {
    return {
      errors: { chatModel: `No API key configured for ${info?.provider ?? 'this provider'}` },
    };
  }
  const db = await getDb();
  const { allowedDomains: _ignored, ...rest } = parsed.data;
  await db
    .update(bots)
    .set({ ...rest, allowedDomains: domains, updatedAt: new Date() })
    .where(eq(bots.id, botId));
  revalidatePath(`/dashboard/bots/${botId}`, 'layout');
  return { ok: true, message: 'Settings saved' };
}

export async function deleteBot(botId: string) {
  await requireBot(botId);
  const db = await getDb();
  await db.delete(bots).where(eq(bots.id, botId));
  redirect('/dashboard');
}

export async function addWebsiteSource(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireBot(botId);
  const parsed = websiteSourceSchema.safeParse({
    url: String(formData.get('url') ?? '').trim(),
    maxPages: formData.get('maxPages') || undefined,
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const e = env();
  try {
    assertCrawlableUrl(parsed.data.url, e.CRAWLER_ALLOW_PRIVATE_NETWORKS);
  } catch (err) {
    if (err instanceof BlockedUrlError) return { errors: { url: err.message } };
    throw err;
  }
  const url = new URL(parsed.data.url);
  const db = await getDb();
  await db.insert(sources).values({
    botId,
    type: 'website',
    name: url.host + (url.pathname === '/' ? '' : url.pathname),
    url: url.toString(),
    config: { maxPages: Math.min(parsed.data.maxPages, e.CRAWLER_MAX_PAGES) },
  });
  scheduleIngestion();
  revalidatePath(`/dashboard/bots/${botId}/sources`);
  return { ok: true, message: 'Website queued for crawling' };
}

export async function addPdfSource(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireBot(botId);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { errors: { file: 'Choose a PDF file' } };
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > maxBytes)
    return { errors: { file: `PDF must be under ${env().MAX_UPLOAD_MB} MB` } };
  const bytes = Buffer.from(await file.arrayBuffer());
  // Check the magic number rather than trusting the browser-provided MIME type.
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-')
    return { errors: { file: 'That file is not a PDF' } };
  const db = await getDb();
  await db.insert(sources).values({
    botId,
    type: 'pdf',
    name: file.name.replace(/\.pdf$/i, '').slice(0, 120) || 'Document',
    fileName: file.name.slice(0, 200),
    fileData: bytes,
    fileSize: file.size,
  });
  scheduleIngestion();
  revalidatePath(`/dashboard/bots/${botId}/sources`);
  return { ok: true, message: 'PDF uploaded and queued' };
}

export async function addTextSource(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireBot(botId);
  const parsed = textSourceSchema.safeParse({
    name: formData.get('name'),
    text: formData.get('text'),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const db = await getDb();
  await db
    .insert(sources)
    .values({ botId, type: 'text', name: parsed.data.name, textContent: parsed.data.text });
  scheduleIngestion();
  revalidatePath(`/dashboard/bots/${botId}/sources`);
  return { ok: true, message: 'Text added and queued' };
}

export async function resyncSource(botId: string, sourceId: string) {
  await requireBot(botId);
  const db = await getDb();
  await db
    .update(sources)
    .set({ status: 'pending', error: null, progress: null, updatedAt: new Date() })
    .where(and(eq(sources.id, sourceId), eq(sources.botId, botId)));
  scheduleIngestion();
  revalidatePath(`/dashboard/bots/${botId}/sources`);
}

export async function resyncAllSources(botId: string) {
  await requireBot(botId);
  const db = await getDb();
  await db
    .update(sources)
    .set({ status: 'pending', error: null, progress: null, updatedAt: new Date() })
    .where(eq(sources.botId, botId));
  scheduleIngestion();
  revalidatePath(`/dashboard/bots/${botId}`, 'layout');
}

export async function deleteSource(botId: string, sourceId: string) {
  await requireBot(botId);
  const db = await getDb();
  await db.delete(sources).where(and(eq(sources.id, sourceId), eq(sources.botId, botId)));
  revalidatePath(`/dashboard/bots/${botId}/sources`);
}
