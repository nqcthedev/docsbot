// Starts the app for Playwright e2e tests against a fresh, isolated embedded database.
// Builds first if there is no production build yet.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const dataDir = ".data/e2e-db";
rmSync(dataDir, { recursive: true, force: true });
rmSync(".data/e2e-widget.json", { force: true });

if (!existsSync(".next/BUILD_ID")) {
  const r = spawnSync("pnpm", ["build"], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const child = spawn("pnpm", ["start"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: `pglite://${dataDir}` } });
const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
