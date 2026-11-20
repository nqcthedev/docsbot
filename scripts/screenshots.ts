/**
 * Captures README screenshots from a running demo (`pnpm demo`) at deviceScaleFactor 2.
 * It first has a handful of real conversations with the bot (live AI calls) so the analytics,
 * conversation log and leads pages show genuine data. Usage: pnpm screenshots
 */
import './load-env';

import type { Page } from '@playwright/test';

import path from 'node:path';
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:3100';
const SITE = 'http://localhost:3101';
const OUT = path.resolve('docs/screenshots');
mkdirSync(OUT, { recursive: true });
const { botId } = JSON.parse(readFileSync('.data/fixture-widget.json', 'utf8')) as {
  botId: string;
};

async function ask(message: string, visitorId: string, conversationId?: string) {
  const res = await fetch(`${APP}/api/v1/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      botId,
      visitorId,
      message,
      conversationId,
      channel: 'widget',
      pageOrigin: SITE,
    }),
  });
  const text = await res.text();
  const conv = text.match(/"conversationId":"([0-9a-f-]+)"/)?.[1];
  const outcome = text.match(/"outcome":"(\w+)"/)?.[1];
  console.log(`  ${outcome?.padEnd(14)} ${message}`);
  await new Promise((r) => setTimeout(r, 1200)); // be gentle with free-tier rate limits
  return conv;
}

async function seedConversations() {
  console.log('Having a few real conversations with the bot…');
  const c1 = await ask('How much does shipping to Canada cost?', 'visitor-aaaa0001');
  await ask('And how long does it take to arrive?', 'visitor-aaaa0001', c1);
  await ask('How much does shipping to Canada cost?', 'visitor-aaaa0002');
  await ask('How long should cold brew steep?', 'visitor-aaaa0003');
  await ask('Can I pause my subscription?', 'visitor-aaaa0004');
  await ask('How much is the Linea Mini espresso machine lease?', 'visitor-aaaa0005');
  await ask('Do you have a loyalty points program?', 'visitor-aaaa0006');
  const c7 = await ask('Can I talk to a human about a large office order?', 'visitor-aaaa0007');
  await fetch(`${APP}/api/v1/leads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      botId,
      conversationId: c7,
      email: 'office.manager@example.com',
      question: 'We need about 30 lb a week for our office. Can someone call me?',
    }),
  });
}

async function shot(page: Page, name: string, opts: { fullPage?: boolean } = {}) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: opts.fullPage ?? false });
  console.log(`  ✓ docs/screenshots/${name}.png`);
}

if (!process.argv.includes('--skip-conversations')) await seedConversations();

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

console.log('Capturing screenshots…');
await page.goto(APP);
await shot(page, 'landing');

await page.goto(`${APP}/login`);
await page.fill('#email', 'demo@example.com');
await page.fill('#password', 'demo-password');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard');

await page.goto(`${APP}/dashboard/bots/${botId}`);
await shot(page, 'analytics', { fullPage: true });
await page.goto(`${APP}/dashboard/bots/${botId}/sources`);
await shot(page, 'sources');

await page.goto(`${APP}/dashboard/bots/${botId}/playground`);
const chat = page.frameLocator('[data-testid="playground-frame"]');
await chat.locator('[data-action="reset"]').click();
await chat
  .locator('textarea')
  .fill(
    'What does the Café tier pay for Harbor House Blend, and can Café accounts lease an espresso machine?'
  );
await chat.locator('textarea').press('Enter');
await chat.locator('.msg.assistant .sources').first().waitFor({ timeout: 60_000 });
await shot(page, 'playground-chat');

await page.goto(`${APP}/dashboard/bots/${botId}/conversations`);
await shot(page, 'conversations');
await page.getByRole('link', { name: 'How much does shipping to Canada cost?' }).first().click();
await page.waitForURL(/conversations\/[0-9a-f-]{36}/);
await shot(page, 'conversation-detail');
await page.goto(`${APP}/dashboard/bots/${botId}/leads`);
await shot(page, 'leads');
await page.goto(`${APP}/dashboard/bots/${botId}/settings`);
await shot(page, 'settings', { fullPage: true });
await page.goto(`${APP}/dashboard/bots/${botId}/install`);
await shot(page, 'install');

// The widget on the "customer" website, as a fresh visitor.
const visitor = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const site = await visitor.newPage();
await site.goto(`${SITE}/shipping`);
await site.locator('[data-docsbot] .bubble').click();
const widget = site.frameLocator('[data-docsbot] iframe');
await widget
  .locator('textarea')
  .fill('Do you ship to Canada? How much is it and how long does it take?');
await widget.locator('textarea').press('Enter');
await widget.locator('.msg.assistant .sources').first().waitFor({ timeout: 60_000 });
await shot(site, 'widget-on-site');
await widget.locator('textarea').fill('Do you offer a student discount?');
await widget.locator('textarea').press('Enter');
await widget.locator('form.lead').waitFor({ timeout: 60_000 });
await shot(site, 'widget-lead-capture');

await browser.close();
console.log('Done.');
