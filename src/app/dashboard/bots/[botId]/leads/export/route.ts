import { listAllLeads } from 'src/server/data';
import { leadsToCsv, leadsCsvFileName } from 'src/server/leads-csv';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

type Context = {
  params: Promise<{ botId: string }>;
};

export async function GET(_request: Request, { params }: Context) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const leads = await listAllLeads(bot.id);

  return new Response(leadsToCsv(leads), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${leadsCsvFileName(bot.name)}"`,
      'cache-control': 'no-store',
    },
  });
}
