/**
 * Limits shared by the zod schemas (server) and the form controls (browser), so the inputs
 * never accept what the server would reject.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const BOT_NAME_MAX_LENGTH = 60;

export const BOT_MESSAGE_MAX_LENGTH = 300;

export const BOT_INSTRUCTIONS_MAX_LENGTH = 2000;

export const BOT_TEMPERATURE_RANGE = { min: 0, max: 1 } as const;

export const BOT_TOP_K_RANGE = { min: 1, max: 12 } as const;

export const DEFAULT_CRAWL_MAX_PAGES = 25;
