import { existsSync } from 'node:fs';
import { devices, defineConfig } from '@playwright/test';

if (existsSync('.env')) process.loadEnvFile('.env');

/**
 * End-to-end: signup → create bot → crawl the Northwind fixture site + upload the PDF → chat in
 * the playground (live AI) → lead capture → embed the widget on the external fixture site.
 * Needs an AI provider key (GEMINI_API_KEY or OPENAI_API_KEY) and free ports 3100 and 3101
 * (override with E2E_APP_PORT / E2E_SITE_PORT).
 */
const appPort = process.env.E2E_APP_PORT ?? '3100';
const sitePort = process.env.E2E_SITE_PORT ?? '3101';
const appUrl = `http://localhost:${appPort}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: appUrl,
    trace: 'off',
    ...devices['Desktop Chrome'],
    viewport: { width: 1360, height: 900 },
  },
  webServer: [
    {
      command: 'pnpm fixture',
      url: `http://localhost:${sitePort}/robots.txt`,
      reuseExistingServer: false,
      env: { FIXTURE_PORT: sitePort, FIXTURE_WIDGET_FILE: '.data/e2e-widget.json' },
      timeout: 30_000,
    },
    {
      command: 'node scripts/e2e-server.mjs',
      url: `${appUrl}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        APP_URL: appUrl,
        PORT: appPort,
        CRAWLER_ALLOW_PRIVATE_NETWORKS: 'true',
        DEFAULT_CHAT_MODEL: process.env.GEMINI_API_KEY ? 'gemini-3.5-flash-lite' : 'gpt-4o-mini',
        LOG_FORMAT: 'json',
      },
    },
  ],
});
