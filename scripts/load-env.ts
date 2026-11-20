import { existsSync } from "node:fs";

/** Loads .env for CLI scripts (Next.js loads it itself for the app). Existing env vars win. */
if (existsSync(".env")) process.loadEnvFile(".env");
