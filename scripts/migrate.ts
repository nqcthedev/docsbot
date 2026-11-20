import { env } from 'src/server/env';
/** Applies SQL migrations in ./drizzle to DATABASE_URL. Usage: pnpm db:migrate */
import { createDatabase } from 'src/server/db';

const url = env().DATABASE_URL;
const handle = await createDatabase(url, { migrate: true });
await handle.close();
console.log(`Migrations applied (${handle.driver}).`);
