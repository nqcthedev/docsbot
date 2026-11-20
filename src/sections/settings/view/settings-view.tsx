import type { IChatModelOption, IBotSettingsValues } from 'src/types/bot';

import { SettingsForm } from '../settings-form';
import { SettingsDeleteBot } from '../settings-delete-bot';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  botName: string;
  defaults: IBotSettingsValues;
  models: IChatModelOption[];
};

export function SettingsView({ botId, botName, defaults, models }: Props) {
  return (
    <div className="space-y-6">
      <SettingsForm botId={botId} defaults={defaults} models={models} />
      <SettingsDeleteBot botId={botId} botName={botName} />
    </div>
  );
}
