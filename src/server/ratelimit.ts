import type { Database } from './db';

import { sql } from 'drizzle-orm';

import { queryRows } from './db';

export interface RateLimitStore {
  /** Atomically increments the counter for (key, window) and returns the new count. */
  increment(key: string, windowStart: Date, windowMs: number): Promise<number>;
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

/**
 * Fixed-window limiter. Counters live in Postgres by default so limits hold across
 * serverless instances and multiple containers; an in-memory store is used in unit tests.
 */
export async function rateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const count = await store.increment(key, windowStart, windowMs);
  const resetAt = new Date(windowStart.getTime() + windowMs);
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
  };
}

export class MemoryRateLimitStore implements RateLimitStore {
  private counts = new Map<string, { count: number; expires: number }>();
  async increment(key: string, windowStart: Date, windowMs: number) {
    const k = `${key}|${windowStart.getTime()}`;
    const now = Date.now();
    if (this.counts.size > 10_000) {
      for (const [kk, v] of this.counts) if (v.expires < now) this.counts.delete(kk);
    }
    const entry = this.counts.get(k) ?? { count: 0, expires: windowStart.getTime() + windowMs };
    entry.count++;
    this.counts.set(k, entry);
    return entry.count;
  }
}

export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private readonly db: Database) {}
  async increment(key: string, windowStart: Date, _windowMs: number) {
    const rows = await queryRows<{ count: number }>(
      this.db,
      sql`INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, ${windowStart.toISOString()}, 1)
          ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
          RETURNING count`
    );
    // Opportunistic cleanup of expired windows (~1% of calls) keeps the table small without a cron.
    if (Math.random() < 0.01) {
      await this.db.execute(
        sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`
      );
    }
    return Number(rows[0]?.count ?? 1);
  }
}
