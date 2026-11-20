import { desc, eq } from "drizzle-orm";
import { requireBot } from "@/server/data";
import { getDb } from "@/server/db";
import { leads } from "@/server/db/schema";

/** CSV cell escaping, including protection against spreadsheet formula injection. */
function csv(value: string | null | undefined) {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const db = await getDb();
  const rows = await db.select().from(leads).where(eq(leads.botId, bot.id)).orderBy(desc(leads.createdAt));
  const body = ["email,name,question,conversation_id,created_at", ...rows.map((l) => [csv(l.email), csv(l.name), csv(l.question), csv(l.conversationId), csv(l.createdAt.toISOString())].join(","))].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${bot.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-leads.csv"`,
      "cache-control": "no-store",
    },
  });
}
