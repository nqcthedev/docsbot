'use client';

import type { IChatModelOption, IBotSettingsValues } from 'src/types/bot';

import { useActionState } from 'react';

import { getFieldErrors, getSuccessMessage } from 'src/utils/form-state';

import { updateBotSettings } from 'src/actions/bot';

import { Alert, Button } from 'src/components/ui';

import { SettingsWidgetCard } from './settings-widget-card';
import { SettingsAnsweringCard } from './settings-answering-card';
import { SettingsAppearanceCard } from './settings-appearance-card';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  defaults: IBotSettingsValues;
  models: IChatModelOption[];
};

export function SettingsForm({ botId, defaults, models }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateBotSettings.bind(null, botId),
    undefined
  );
  const errors = getFieldErrors(state);
  const successMessage = getSuccessMessage(state);
  const hasErrors = state?.ok === false;

  return (
    <form action={formAction} className="space-y-6">
      <SettingsAppearanceCard defaults={defaults} errors={errors} />
      <SettingsAnsweringCard defaults={defaults} errors={errors} models={models} />
      <SettingsWidgetCard defaults={defaults} errors={errors} />

      <div className="flex items-center gap-3">
        <Button type="submit" variant="brand" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save settings'}
        </Button>
        {successMessage ? (
          <Alert tone="green" className="py-1.5">
            {successMessage}
          </Alert>
        ) : null}
        {hasErrors ? (
          <Alert tone="red" className="py-1.5">
            Please fix the highlighted fields.
          </Alert>
        ) : null}
      </div>
    </form>
  );
}
