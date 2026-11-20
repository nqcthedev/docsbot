import { CONFIG } from 'src/config-global';
import { availableChatModels } from 'src/server/ai/registry';

import { SettingsView } from 'src/sections/settings/view';

import { requireBot } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Settings · ${CONFIG.appName}` };

type Props = {
  params: Promise<{ botId: string }>;
};

export default async function Page({ params }: Props) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  // Only what the form shows goes to the browser (no prices or provider params).
  const models = availableChatModels().map(({ id, label, provider, available }) => ({
    id,
    label,
    provider,
    available,
  }));

  return (
    <SettingsView
      botId={bot.id}
      botName={bot.name}
      models={models}
      defaults={{
        name: bot.name,
        welcomeMessage: bot.welcomeMessage,
        fallbackMessage: bot.fallbackMessage,
        brandColor: bot.brandColor,
        instructions: bot.instructions,
        chatModel: bot.chatModel,
        temperature: bot.temperature,
        minSimilarity: bot.minSimilarity,
        topK: bot.topK,
        allowedDomains: bot.allowedDomains.join('\n'),
        leadCaptureEnabled: bot.leadCaptureEnabled,
      }}
    />
  );
}
