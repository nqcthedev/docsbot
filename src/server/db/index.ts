import type { SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import path from 'node:path';

import { env } from 'src/server/env';
import { logger } from 'src/server/logger';

import * as schema from './schema';

/**
 * One database handle type for both drivers:
 *  - postgres-js  → real Postgres + pgvector (production, docker-compose, CI)
 *  - PGlite       → embedded WASM Postgres + pgvector (zero-setup local dev and tests)
 * Application code only uses the shared Drizzle query builder, so both paths run the same SQL.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

type Handle = { db: Database; close: () => Promise<void>; driver: 'postgres' | 'pglite' };

const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle');
const GLOBAL_KEY = Symbol.for('docsbot.db');
type GlobalWithDb = typeof globalThis & { [GLOBAL_KEY]?: Promise<Handle> };

export async function createDatabase(
  url: string,
  opts: { migrate?: boolean } = {}
): Promise<Handle> {
  if (url.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { vector } = await import('@electric-sql/pglite-pgvector');
    const { drizzle } = await import('drizzle-orm/pglite');
    const target = url.slice('pglite://'.length);
    const dataDir = target === 'memory' || target === '' ? undefined : path.resolve(target);
    if (dataDir) (await import('node:fs')).mkdirSync(path.dirname(dataDir), { recursive: true });
    const client = new PGlite({ dataDir, extensions: { vector } });
    const db = drizzle({ client, schema }) as unknown as Database;
    if (opts.migrate) {
      const { migrate } = await import('drizzle-orm/pglite/migrator');
      await migrate(db as never, { migrationsFolder: MIGRATIONS_DIR });
    }
    return { db, driver: 'pglite', close: () => client.close() };
  }

  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    // Supabase/Neon poolers (pgbouncer transaction mode) do not support prepared statements.
    prepare: process.env.DATABASE_PREPARE !== 'false',
    onnotice: () => {},
  });
  const db = drizzle({ client, schema }) as unknown as Database;
  if (opts.migrate) {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    await migrate(db as never, { migrationsFolder: MIGRATIONS_DIR });
  }
  return { db, driver: 'postgres', close: () => client.end({ timeout: 5 }) };
}

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function getDb(): Promise<Database> {
  const g = globalThis as GlobalWithDb;
  if (!g[GLOBAL_KEY]) {
    const { DATABASE_URL, DB_AUTO_MIGRATE } = env();
    const autoMigrate = DATABASE_URL.startsWith('pglite://') && DB_AUTO_MIGRATE;
    g[GLOBAL_KEY] = createDatabase(DATABASE_URL, { migrate: autoMigrate }).then((h) => {
      logger.info('database connected', { driver: h.driver, migrated: autoMigrate });
      return h;
    });
    g[GLOBAL_KEY].catch(() => {
      delete g[GLOBAL_KEY];
    });
  }
  return g[GLOBAL_KEY].then((h) => h.db);
}

/** Lets tests and scripts inject a database (e.g. in-memory PGlite). */
export function setDbForTesting(handle: Handle | undefined) {
  const g = globalThis as GlobalWithDb;
  if (handle) g[GLOBAL_KEY] = Promise.resolve(handle);
  else delete g[GLOBAL_KEY];
}

export async function closeDb() {
  const g = globalThis as GlobalWithDb;
  const h = await g[GLOBAL_KEY];
  delete g[GLOBAL_KEY];
  await h?.close();
}

/** Raw query helper that normalises the result shape of both drivers. */
export async function queryRows<T>(db: Database, query: SQL): Promise<T[]> {
  const res = (await db.execute(query)) as unknown;
  if (Array.isArray(res)) return res as T[];
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}

export { schema };
