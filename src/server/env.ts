import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : v === 'true' || v === '1'));

const int = (def: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(def);

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.url().default('http://localhost:3100'),
    /**
     * postgres://… (production: Neon, Supabase, self-hosted pgvector) or
     * pglite://<dir> / pglite://memory (zero-setup embedded Postgres for local dev and tests).
     */
    DATABASE_URL: z
      .string()
      .default('pglite://.data/pglite')
      .refine(
        (v) => /^(postgres(ql)?|pglite):\/\//.test(v),
        'DATABASE_URL must start with postgres://, postgresql:// or pglite://'
      ),
    DB_AUTO_MIGRATE: bool(true),

    // --- AI providers -------------------------------------------------------
    GEMINI_API_KEY: optionalString,
    GEMINI_BASE_URL: z.url().default('https://generativelanguage.googleapis.com/v1beta/openai/'),
    OPENAI_API_KEY: optionalString,
    OPENAI_BASE_URL: z.url().default('https://api.openai.com/v1/'),
    ANTHROPIC_API_KEY: optionalString,
    ANTHROPIC_BASE_URL: optionalString,

    DEFAULT_CHAT_MODEL: z.string().default('gemini-2.5-flash'),
    /** Comma separated, tried in order after the bot's own model fails (429 / 5xx / timeout). */
    CHAT_FALLBACK_MODELS: z.string().default('gemini-3.5-flash-lite,gpt-4o-mini,claude-haiku-5-5'),
    EMBEDDING_PROVIDER: z.enum(['gemini', 'openai']).optional(),
    EMBEDDING_MODEL: optionalString,
    AI_TIMEOUT_MS: int(30_000, 1_000, 300_000),
    AI_MAX_RETRIES: int(2, 0, 6),

    // --- Ingestion ----------------------------------------------------------
    /** Allow crawling localhost / private IPs. Only for local development and tests (SSRF protection). */
    CRAWLER_ALLOW_PRIVATE_NETWORKS: bool(false),
    CRAWLER_MAX_PAGES: int(100, 1, 1000),
    CRAWLER_TIMEOUT_MS: int(10_000, 1_000, 60_000),
    MAX_UPLOAD_MB: int(10, 1, 50),
    /** "inline": process the ingestion queue inside the web process (Node server / Docker). "off": only via /api/cron/ingest. */
    INGEST_WORKER: z.enum(['inline', 'off']).default('inline'),
    CRON_SECRET: optionalString,

    // --- Abuse protection ---------------------------------------------------
    RATE_LIMIT_CHAT_PER_IP_PER_MINUTE: int(20, 1, 10_000),
    RATE_LIMIT_CHAT_PER_BOT_PER_HOUR: int(600, 1, 1_000_000),
    MAX_MESSAGE_CHARS: int(2_000, 50, 20_000),
    /** Trust X-Forwarded-For (set to false when not running behind a proxy you control). */
    TRUST_PROXY: bool(true),

    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .transform((env) => ({
    ...env,
    EMBEDDING_PROVIDER: env.EMBEDDING_PROVIDER ?? (env.GEMINI_API_KEY ? 'gemini' : 'openai'),
  }));

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parsed lazily so `next build` works without runtime secrets. Throws a readable error on misconfiguration. */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests only. */
export function resetEnvCache() {
  cached = undefined;
}
