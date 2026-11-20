/**
 * One command to run the complete local demo:
 *   1. seeds the demo account + Northwind bot (first run only; calls the embedding API)
 *   2. builds the app if needed
 *   3. serves the Northwind Coffee demo site on :3101 (with the chat widget embedded)
 *   4. starts DocsBot on :3100
 * Usage: pnpm demo            (add --reset to re-create the demo data, --rebuild to rebuild)
 */
import "./load-env";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const childEnv: NodeJS.ProcessEnv = { ...process.env };
// Node's fetch ignores HTTP(S)_PROXY unless asked to (Node >= 22.21). Only matters behind a proxy.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) childEnv.NODE_USE_ENV_PROXY = "1";
childEnv.NODE_NO_WARNINGS = "1";
childEnv.CRAWLER_ALLOW_PRIVATE_NETWORKS ??= "true"; // the demo site runs on localhost

if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
  console.error("Set GEMINI_API_KEY or OPENAI_API_KEY in .env first (see .env.example).");
  process.exit(1);
}

const run = (cmd: string, cmdArgs: string[]) => {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", env: childEnv });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log("\n▶ Seeding demo data…");
run("pnpm", ["-s", "seed", ...(args.includes("--reset") ? ["--reset"] : [])]);

if (args.includes("--rebuild") || !existsSync(".next/BUILD_ID")) {
  console.log("\n▶ Building the app…");
  run("pnpm", ["-s", "build"]);
} else if (!existsSync("public/widget.js")) {
  run("pnpm", ["-s", "build:widget"]);
}

const children: ChildProcess[] = [
  spawn("pnpm", ["-s", "fixture"], { stdio: "inherit", env: childEnv }),
  spawn("pnpm", ["-s", "start"], { stdio: "inherit", env: childEnv }),
];

setTimeout(() => {
  const app = process.env.APP_URL ?? "http://localhost:3100";
  console.log(`
────────────────────────────────────────────────────────────
  DocsBot dashboard   ${app}/login
                      demo@example.com / demo-password
  Demo customer site  http://localhost:3101   (chat bubble bottom-right)
  Press Ctrl+C to stop.
────────────────────────────────────────────────────────────`);
}, 4000);

const stop = () => {
  for (const c of children) c.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const c of children) c.on("exit", (code) => code && code !== 0 && stop());
