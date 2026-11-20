import type { Lead } from './db/schema';

// ----------------------------------------------------------------------

/** Spreadsheets run cells starting with these characters as formulas (CSV injection). */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

const HEADER = 'email,name,question,conversation_id,created_at';

/** Quotes a CSV cell and defuses spreadsheet formulas by prefixing them with an apostrophe. */
export function csvCell(value: string | null | undefined) {
  const text = value ?? '';
  const safeText = FORMULA_TRIGGER.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

export function leadsToCsv(leads: Lead[]) {
  const rows = leads.map((lead) =>
    [lead.email, lead.name, lead.question, lead.conversationId, lead.createdAt.toISOString()]
      .map(csvCell)
      .join(',')
  );
  return [HEADER, ...rows].join('\n');
}

/** "Northwind Support" → "northwind-support-leads.csv". */
export function leadsCsvFileName(botName: string) {
  return `${botName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-leads.csv`;
}
