import packageJson from '../package.json';

// ----------------------------------------------------------------------

export type ConfigValue = {
  appName: string;
  appVersion: string;
  appTagline: string;
  appDescription: string;
  author: string;
  /** How often the Sources page refreshes while an ingestion job is queued or running. */
  sourcesPollIntervalMs: number;
};

/**
 * Static, browser-safe app settings. Deployment settings (APP_URL, keys, limits) are not
 * here: they are server-only and validated at startup in src/server/env.ts.
 */
export const CONFIG: ConfigValue = {
  appName: 'DocsBot',
  appVersion: packageJson.version,
  appTagline: 'AI support chatbot trained on your docs',
  appDescription:
    'Train a support chatbot on your website, PDFs and FAQs. Grounded answers with citations, lead capture and analytics. Embed it with one line.',
  author: 'Cuong Nguyen',
  sourcesPollIntervalMs: 1500,
};
