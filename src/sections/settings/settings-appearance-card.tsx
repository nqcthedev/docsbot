'use client';

import type { FieldErrors } from 'src/types/common';
import type { IBotSettingsValues } from 'src/types/bot';

import { useState, useCallback } from 'react';

import { BOT_NAME_MAX_LENGTH, BOT_MESSAGE_MAX_LENGTH } from 'src/shared/constants';

import { Card, Field, Input, Textarea, CardHeader } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  defaults: IBotSettingsValues;
  errors: FieldErrors;
};

export function SettingsAppearanceCard({ defaults, errors }: Props) {
  // The swatch and the hex input edit the same value; only the hex input is submitted.
  const [brandColor, setBrandColor] = useState(defaults.brandColor);

  const handleColorChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setBrandColor(event.target.value),
    []
  );

  return (
    <Card>
      <CardHeader title="Appearance" description="How the widget looks and greets visitors." />
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <Field label="Bot name" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            name="name"
            defaultValue={defaults.name}
            required
            maxLength={BOT_NAME_MAX_LENGTH}
          />
        </Field>
        <Field label="Brand color" htmlFor="brandColor" error={errors.brandColor}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick brand color"
              value={brandColor}
              onChange={handleColorChange}
              className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white p-1"
            />
            <Input
              id="brandColor"
              name="brandColor"
              value={brandColor}
              onChange={handleColorChange}
              className="w-32 font-mono"
            />
          </div>
        </Field>
        <Field label="Welcome message" htmlFor="welcomeMessage" error={errors.welcomeMessage}>
          <Textarea
            id="welcomeMessage"
            name="welcomeMessage"
            defaultValue={defaults.welcomeMessage}
            rows={2}
            maxLength={BOT_MESSAGE_MAX_LENGTH}
          />
        </Field>
        <Field
          label="Fallback message"
          htmlFor="fallbackMessage"
          error={errors.fallbackMessage}
          hint="Shown when the answer isn't in your sources."
        >
          <Textarea
            id="fallbackMessage"
            name="fallbackMessage"
            defaultValue={defaults.fallbackMessage}
            rows={2}
            maxLength={BOT_MESSAGE_MAX_LENGTH}
          />
        </Field>
      </div>
    </Card>
  );
}
