import { availableChatModels } from "@/server/ai/registry";
import { requireBot } from "@/server/data";
import { SettingsForm } from "./settings-form";
import { DeleteBot } from "./delete-bot";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const models = availableChatModels().map((m) => ({ id: m.id, label: m.label, provider: m.provider, available: m.available }));
  return (
    <div className="space-y-6">
      <SettingsForm
        botId={bot.id}
        models={models}
        initial={{
          name: bot.name,
          welcomeMessage: bot.welcomeMessage,
          fallbackMessage: bot.fallbackMessage,
          brandColor: bot.brandColor,
          instructions: bot.instructions,
          chatModel: bot.chatModel,
          temperature: bot.temperature,
          minSimilarity: bot.minSimilarity,
          topK: bot.topK,
          allowedDomains: bot.allowedDomains.join("\n"),
          leadCaptureEnabled: bot.leadCaptureEnabled,
        }}
      />
      <DeleteBot botId={bot.id} name={bot.name} />
    </div>
  );
}
