import type { Bot } from 'src/server/db/schema';
import type { botAnalytics } from 'src/server/data';
import type { ChatModelInfo } from 'src/server/ai/models';
import type { BotSettingsInput } from 'src/server/validation';

// ----------------------------------------------------------------------

export type IBotItem = Bot;

/** The fields the sidebar needs to list a bot. */
export type IBotNavItem = Pick<Bot, 'id' | 'name' | 'brandColor'>;

/** A bot card on the dashboard home. Activity figures cover the last 30 days. */
export type IBotSummary = {
  bot: Bot;
  conversations30d: number;
  leads: number;
  sources: number;
  chunks: number;
  cost30d: number;
};

/** Counters shown on the bot header and its tabs. */
export type IBotTabCounts = {
  sources: number;
  readySources: number;
  leads: number;
};

/** Why the bot declined a question (see the `outcome` column of messages). */
export type IUnansweredOutcome = 'low_confidence' | 'no_answer';

export type IBotAnalytics = Awaited<ReturnType<typeof botAnalytics>>;

/** Values of the settings form, exactly as the settings schema validates them. */
export type IBotSettingsValues = BotSettingsInput;

export type IChatModelOption = Pick<ChatModelInfo, 'id' | 'label' | 'provider'> & {
  available: boolean;
};
