/**
 * Seeds a demo account with a bot trained on the fictional Northwind Coffee Roasters site
 * (crawled from the local fixture server), the wholesale PDF and a pasted FAQ. Ingestion
 * calls the real embedding API. Usage: pnpm seed [--reset]
 *
 * With PGlite, run this while the app is stopped (an embedded database has a single owner).
 */
import "./load-env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { hashPassword } from "../src/server/auth/password";
import { buildRegistry } from "../src/server/ai/registry";
import { createDatabase } from "../src/server/db";
import { bots, sources, users, workspaces } from "../src/server/db/schema";
import { env } from "../src/server/env";
import { claimNextSource, ingestSource, markSourceFailed } from "../src/server/ingest/pipeline";
import { logger } from "../src/server/logger";
import { startFixtureServer } from "../fixtures/northwind/server";

export const DEMO_EMAIL = "demo@example.com";
export const DEMO_PASSWORD = "demo-password";

const e = env();
const fixturePort = Number(process.env.FIXTURE_PORT ?? 3101);
const siteUrl = `http://localhost:${fixturePort}`;
const reset = process.argv.includes("--reset");

const handle = await createDatabase(e.DATABASE_URL, { migrate: true });
const db = handle.db;

async function main() {
  const [existing] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing && !reset) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.ownerId, existing.id));
    const [bot] = ws ? await db.select().from(bots).where(eq(bots.workspaceId, ws.id)) : [];
    if (bot) writeWidgetConfig(bot.id);
    console.log(`Demo account already exists (${DEMO_EMAIL}). Use --reset to recreate it.`);
    return;
  }
  if (existing) await db.delete(users).where(eq(users.id, existing.id));

  const registry = buildRegistry(e);
  if (!registry.embeddings) throw new Error("Set GEMINI_API_KEY or OPENAI_API_KEY before seeding: ingestion needs an embedding provider.");

  const [user] = await db.insert(users).values({ email: DEMO_EMAIL, name: "Demo User", passwordHash: await hashPassword(DEMO_PASSWORD) }).returning();
  const [ws] = await db.insert(workspaces).values({ name: "Northwind Coffee", ownerId: user!.id }).returning();
  const chatModel = registry.chat.gemini ? "gemini-2.5-flash" : registry.chat.openai ? "gpt-4o-mini" : "claude-haiku-5-5";
  const [bot] = await db
    .insert(bots)
    .values({
      workspaceId: ws!.id,
      name: "Northwind Assistant",
      brandColor: "#b4532a",
      welcomeMessage: "Hi! I'm the Northwind assistant. Ask me about shipping, subscriptions, brewing or wholesale.",
      fallbackMessage: "I couldn't find that in our documentation. Leave your email and our team will get back to you.",
      instructions: "Warm, friendly and concise, like a knowledgeable barista. When a question is about ordering regularly, mention subscriptions only if the context covers them.",
      chatModel,
      allowedDomains: [`localhost:${fixturePort}`],
    })
    .returning();

  const pdfPath = path.resolve("fixtures/northwind/northwind-wholesale-guide.pdf");
  const pdf = readFileSync(pdfPath);
  await db.insert(sources).values([
    { botId: bot!.id, type: "website", name: `localhost:${fixturePort}`, url: `${siteUrl}/`, config: { maxPages: 30 } },
    { botId: bot!.id, type: "pdf", name: "Northwind Wholesale Program Guide 2026", fileName: path.basename(pdfPath), fileData: pdf, fileSize: pdf.length },
    {
      botId: bot!.id,
      type: "text",
      name: "Holiday shipping schedule",
      textContent:
        "# Holiday shipping schedule 2026\n\nTo receive coffee before December 25 with standard shipping, place your order by December 16. With expedited shipping, order by December 21.\n\nThe roastery is closed from December 25 to January 1. Orders placed during the closure ship on Monday, January 4.",
    },
  ]);

  // Serve the fixture site for the crawl if it isn't already running.
  let server: Awaited<ReturnType<typeof startFixtureServer>> | undefined;
  const running = await fetch(`${siteUrl}/robots.txt`).then((r) => r.ok).catch(() => false);
  if (!running) server = await startFixtureServer({ port: fixturePort, host: "0.0.0.0" });

  try {
    let id: string | undefined;
    while ((id = await claimNextSource(db))) {
      try {
        const r = await ingestSource(id, {
          db,
          embeddings: registry.embeddings,
          allowPrivateNetworks: true, // the demo site runs on localhost
          maxPagesCap: e.CRAWLER_MAX_PAGES,
          crawlTimeoutMs: e.CRAWLER_TIMEOUT_MS,
          logger,
        });
        console.log(`  ✓ ingested source ${id}: ${r.documents} documents, ${r.chunks} chunks (${r.embedded} embedded)`);
      } catch (err) {
        await markSourceFailed(db, id, (err as Error).message);
        console.error(`  ✗ source ${id} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    server?.close();
  }

  writeWidgetConfig(bot!.id);
  console.log(`\nDemo ready. Log in at ${e.APP_URL}/login with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Bot id: ${bot!.id}`);
}

function writeWidgetConfig(botId: string) {
  const file = path.resolve(".data/fixture-widget.json");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ appUrl: e.APP_URL, botId }, null, 2));
  console.log(`Widget will be injected into the demo site (${siteUrl}) via ${path.relative(process.cwd(), file)}`);
}

try {
  await main();
} finally {
  await handle.close();
}
