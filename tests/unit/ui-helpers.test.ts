import type { Lead } from 'src/server/db/schema';

import { it, expect, describe } from 'vitest';

import { paths } from 'src/routes/paths';
import { isActivePath } from 'src/routes/utils';

import { formatUsd, formatCount, formatNumber } from 'src/utils/format-number';
import { formatTimeAgo, formatDateTime, formatMonthDay } from 'src/utils/format-time';
import { getFieldErrors, getSuccessMessage, getSubmittedValue } from 'src/utils/form-state';

import { csvCell, leadsToCsv, leadsCsvFileName } from 'src/server/leads-csv';

import { barChartTicks } from 'src/components/chart/utils';

import { buildEmbedSnippet, buildChatApiExample } from 'src/sections/install/utils';
import {
  describeSourceOrigin,
  describeSourceContents,
  describeSourceProgress,
} from 'src/sections/source/utils';

const BOT_ID = '6f1c1a2e-6a59-4c1e-9d55-6c8b0f3b2a10';

describe('route helpers', () => {
  it('builds every bot URL from the bot id', () => {
    expect(paths.dashboard.bot.root(BOT_ID)).toBe(`/dashboard/bots/${BOT_ID}`);
    expect(paths.dashboard.bot.sources(BOT_ID)).toBe(`/dashboard/bots/${BOT_ID}/sources`);
    expect(paths.dashboard.bot.conversation(BOT_ID, 'c1')).toBe(
      `/dashboard/bots/${BOT_ID}/conversations/c1`
    );
    expect(paths.embed.standalone(BOT_ID)).toBe(`/embed/${BOT_ID}?mode=standalone`);
  });

  it('matches sub-pages but not siblings that share a prefix', () => {
    expect(isActivePath('/dashboard/bots/1/sources', '/dashboard/bots/1')).toBe(true);
    expect(isActivePath('/dashboard/bots/12', '/dashboard/bots/1')).toBe(false);
    expect(isActivePath('/dashboard/bots/1/sources', '/dashboard/bots/1', true)).toBe(false);
    expect(isActivePath('/dashboard', '/dashboard', true)).toBe(true);
  });
});

describe('formatting', () => {
  it('formats numbers, costs and counts', () => {
    expect(formatNumber(12345)).toBe('12,345');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.00042)).toBe('$0.0004');
    expect(formatUsd(3.5)).toBe('$3.50');
    expect(formatCount(1, 'page')).toBe('1 page');
    expect(formatCount(2000, 'chunk')).toBe('2,000 chunks');
  });

  it('formats relative times and chart days', () => {
    const now = Date.parse('2026-11-20T12:00:00Z');
    expect(formatTimeAgo(new Date(now - 10_000), now)).toBe('just now');
    expect(formatTimeAgo(new Date(now - 5 * 60_000), now)).toBe('5m ago');
    expect(formatTimeAgo(new Date(now - 3 * 3_600_000), now)).toBe('3h ago');
    expect(formatTimeAgo('2026-11-18T12:00:00Z', now)).toBe('2d ago');
    expect(formatTimeAgo('2026-01-05T12:00:00Z', now)).toBe('Jan 5, 2026');
    expect(formatMonthDay('2026-11-20')).toBe('11/20');
    expect(formatDateTime('2026-11-20T15:04:00')).toMatch(/^Nov 20, 3:04\sPM$/);
  });

  it('chooses gridlines for small and large maxima', () => {
    expect(barChartTicks(3)).toEqual([0, 1, 2, 3]);
    expect(barChartTicks(41)).toEqual([0, 21, 41]);
  });
});

describe('form state', () => {
  it('reads errors, submitted values and success messages', () => {
    const failed = {
      ok: false as const,
      errors: { email: 'Enter a valid email' },
      values: { email: 'x' },
    };
    expect(getFieldErrors(failed).email).toBe('Enter a valid email');
    expect(getSubmittedValue(failed, 'email')).toBe('x');
    expect(getSuccessMessage(failed)).toBeUndefined();
    expect(getFieldErrors(undefined)).toEqual({});
    expect(getSuccessMessage({ ok: true, message: 'Saved' })).toBe('Saved');
  });
});

describe('source descriptions', () => {
  it('describes where content comes from', () => {
    const base = { url: null, fileName: null, fileSize: null };
    expect(describeSourceOrigin({ ...base, type: 'website', url: 'https://a.example' })).toBe(
      'https://a.example'
    );
    expect(
      describeSourceOrigin({ ...base, type: 'pdf', fileName: 'guide.pdf', fileSize: 20_480 })
    ).toBe('guide.pdf · 20 KB');
    expect(describeSourceOrigin({ ...base, type: 'text' })).toBe('Pasted text');
  });

  it('describes ingestion progress and results', () => {
    expect(describeSourceProgress({ stage: 'crawling', done: 1, total: null })).toBe(
      'Crawling… 1 page fetched'
    );
    expect(describeSourceProgress({ stage: 'embedding', done: 3, total: null })).toBe(
      'Embedding 3/? chunks…'
    );
    expect(describeSourceProgress({ stage: 'chunking', done: 0, total: null })).toBe('Chunking…');
    expect(
      describeSourceContents({
        type: 'website',
        documentCount: 14,
        chunkCount: 1,
        tokenCount: 9800,
      })
    ).toBe('14 pages · 1 chunk · ~9,800 tokens');
  });
});

describe('install snippets', () => {
  it('points the embed snippet and API example at this deployment', () => {
    expect(buildEmbedSnippet('https://bots.example', BOT_ID)).toBe(
      `<script src="https://bots.example/widget.js" data-bot-id="${BOT_ID}" async></script>`
    );
    expect(buildChatApiExample('https://bots.example', BOT_ID)).toContain(
      `curl -N https://bots.example/api/v1/chat`
    );
    expect(buildChatApiExample('https://bots.example', BOT_ID)).toContain(`"botId":"${BOT_ID}"`);
  });
});

describe('leads CSV export', () => {
  it('quotes cells and defuses spreadsheet formulas', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(null)).toBe('""');
  });

  it('writes a header and one row per lead', () => {
    const lead: Lead = {
      id: 'l1',
      botId: BOT_ID,
      conversationId: null,
      email: 'a@example.com',
      name: null,
      question: 'Hours?',
      createdAt: new Date('2026-11-20T00:00:00Z'),
    };
    expect(leadsToCsv([lead]).split('\n')).toEqual([
      'email,name,question,conversation_id,created_at',
      '"a@example.com","","Hours?","","2026-11-20T00:00:00.000Z"',
    ]);
    expect(leadsCsvFileName('Northwind Support!')).toBe('northwind-support--leads.csv');
  });
});
