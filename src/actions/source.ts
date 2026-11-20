'use server';

import type { FormState } from 'src/types/common';

import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { paths } from 'src/routes/paths';

import { env } from 'src/server/env';
import { getDb } from 'src/server/db';
import { sources } from 'src/server/db/schema';
import { BlockedUrlError, assertCrawlableUrl } from 'src/server/ingest/url-guard';
import { entityIdSchema, textSourceSchema, websiteSourceSchema } from 'src/server/validation';

import { requireBot } from 'src/auth/guard';

import { invalid, formText, scheduleIngestion } from './helpers';

// ----------------------------------------------------------------------

const BYTES_PER_MB = 1024 * 1024;
/** Every PDF starts with these bytes; the browser-provided MIME type is not trusted. */
const PDF_MAGIC_NUMBER = '%PDF-';
const SOURCE_NAME_MAX_LENGTH = 120;
const FILE_NAME_MAX_LENGTH = 200;

/** A source id bound to a form by the page. It is client-controlled, so it is checked too. */
function parseSourceId(sourceId: string) {
  const parsed = entityIdSchema.safeParse(sourceId);
  if (!parsed.success) notFound();
  return parsed.data;
}

const PENDING_RESET = { status: 'pending', error: null, progress: null } as const;

// ----------------------------------------------------------------------

export async function addWebsiteSource(
  botId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBot(botId);
  const parsed = websiteSourceSchema.safeParse({
    url: formText(formData, 'url').trim(),
    maxPages: formText(formData, 'maxPages') || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const { CRAWLER_ALLOW_PRIVATE_NETWORKS, CRAWLER_MAX_PAGES } = env();
  try {
    assertCrawlableUrl(parsed.data.url, CRAWLER_ALLOW_PRIVATE_NETWORKS);
  } catch (error) {
    if (error instanceof BlockedUrlError) return { ok: false, errors: { url: error.message } };
    throw error;
  }

  const url = new URL(parsed.data.url);
  const db = await getDb();
  await db.insert(sources).values({
    botId,
    type: 'website',
    name: url.host + (url.pathname === '/' ? '' : url.pathname),
    url: url.toString(),
    config: { maxPages: Math.min(parsed.data.maxPages, CRAWLER_MAX_PAGES) },
  });
  scheduleIngestion();
  revalidatePath(paths.dashboard.bot.sources(botId));
  return { ok: true, message: 'Website queued for crawling' };
}

// ----------------------------------------------------------------------

export async function addPdfSource(
  botId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBot(botId);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: { file: 'Choose a PDF file' } };
  }
  const { MAX_UPLOAD_MB } = env();
  if (file.size > MAX_UPLOAD_MB * BYTES_PER_MB) {
    return { ok: false, errors: { file: `PDF must be under ${MAX_UPLOAD_MB} MB` } };
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, PDF_MAGIC_NUMBER.length).toString('latin1') !== PDF_MAGIC_NUMBER) {
    return { ok: false, errors: { file: 'That file is not a PDF' } };
  }

  const db = await getDb();
  await db.insert(sources).values({
    botId,
    type: 'pdf',
    name: file.name.replace(/\.pdf$/i, '').slice(0, SOURCE_NAME_MAX_LENGTH) || 'Document',
    fileName: file.name.slice(0, FILE_NAME_MAX_LENGTH),
    fileData: bytes,
    fileSize: file.size,
  });
  scheduleIngestion();
  revalidatePath(paths.dashboard.bot.sources(botId));
  return { ok: true, message: 'PDF uploaded and queued' };
}

// ----------------------------------------------------------------------

export async function addTextSource(
  botId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBot(botId);
  const parsed = textSourceSchema.safeParse({
    name: formText(formData, 'name'),
    text: formText(formData, 'text'),
  });
  if (!parsed.success) return invalid(parsed.error);

  const db = await getDb();
  await db
    .insert(sources)
    .values({ botId, type: 'text', name: parsed.data.name, textContent: parsed.data.text });
  scheduleIngestion();
  revalidatePath(paths.dashboard.bot.sources(botId));
  return { ok: true, message: 'Text added and queued' };
}

// ----------------------------------------------------------------------

export async function resyncSource(botId: string, sourceId: string) {
  await requireBot(botId);
  const id = parseSourceId(sourceId);
  const db = await getDb();
  await db
    .update(sources)
    .set({ ...PENDING_RESET, updatedAt: new Date() })
    .where(and(eq(sources.id, id), eq(sources.botId, botId)));
  scheduleIngestion();
  revalidatePath(paths.dashboard.bot.sources(botId));
}

export async function resyncAllSources(botId: string) {
  await requireBot(botId);
  const db = await getDb();
  await db
    .update(sources)
    .set({ ...PENDING_RESET, updatedAt: new Date() })
    .where(eq(sources.botId, botId));
  scheduleIngestion();
  // Every page of the bot shows source state (tab counters, the overview's stale-model banner).
  revalidatePath(paths.dashboard.bot.root(botId), 'layout');
}

export async function deleteSource(botId: string, sourceId: string) {
  await requireBot(botId);
  const id = parseSourceId(sourceId);
  const db = await getDb();
  await db.delete(sources).where(and(eq(sources.id, id), eq(sources.botId, botId)));
  revalidatePath(paths.dashboard.bot.sources(botId));
}
