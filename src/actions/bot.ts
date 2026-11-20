'use server';

import type { FormState } from 'src/types/common';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { paths } from 'src/routes/paths';

import { env } from 'src/server/env';
import { getDb } from 'src/server/db';
import { logger } from 'src/server/logger';
import { bots } from 'src/server/db/schema';
import { AppError } from 'src/server/errors';
import { parseDomainList } from 'src/server/domains';
import { chatModelInfo } from 'src/server/ai/models';
import { availableChatModels } from 'src/server/ai/registry';
import { createBotSchema, botSettingsSchema } from 'src/server/validation';

import { requireBot, requireUser } from 'src/auth/guard';

import { invalid, formText } from './helpers';

// ----------------------------------------------------------------------

/** The configured default model if its provider has a key, else the first usable model. */
function defaultChatModel(): string {
  const models = availableChatModels();
  const preferred = env().DEFAULT_CHAT_MODEL;
  if (models.some((model) => model.id === preferred && model.available)) return preferred;
  return models.find((model) => model.available)?.id ?? preferred;
}

// ----------------------------------------------------------------------

export async function createBot(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = createBotSchema.safeParse({ name: formText(formData, 'name') });
  if (!parsed.success) return invalid(parsed.error);

  const db = await getDb();
  const [bot] = await db
    .insert(bots)
    .values({
      workspaceId: user.workspaceId,
      name: parsed.data.name,
      chatModel: defaultChatModel(),
    })
    .returning({ id: bots.id });
  if (!bot) throw new AppError('create_failed', 'Could not create the bot', 500);

  logger.info('bot created', { botId: bot.id, userId: user.id });
  redirect(paths.dashboard.bot.sources(bot.id));
}

// ----------------------------------------------------------------------

export async function updateBotSettings(
  botId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBot(botId);
  const parsed = botSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const { allowedDomains, ...settings } = parsed.data;
  const { domains, invalid: invalidDomains } = parseDomainList(allowedDomains);
  if (invalidDomains.length) {
    return {
      ok: false,
      errors: { allowedDomains: `Not a valid domain: ${invalidDomains.join(', ')}` },
    };
  }

  const model = chatModelInfo(settings.chatModel);
  const isModelUsable = availableChatModels().some(
    (option) => option.id === model?.id && option.available
  );
  if (!isModelUsable) {
    return {
      ok: false,
      errors: { chatModel: `No API key configured for ${model?.provider ?? 'this provider'}` },
    };
  }

  const db = await getDb();
  await db
    .update(bots)
    .set({ ...settings, allowedDomains: domains, updatedAt: new Date() })
    .where(eq(bots.id, botId));
  revalidatePath(paths.dashboard.bot.root(botId), 'layout');
  return { ok: true, message: 'Settings saved' };
}

// ----------------------------------------------------------------------

export async function deleteBot(botId: string) {
  await requireBot(botId);
  const db = await getDb();
  await db.delete(bots).where(eq(bots.id, botId));
  redirect(paths.dashboard.root);
}
