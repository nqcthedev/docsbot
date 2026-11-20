'use client';

import type { FieldErrors } from 'src/types/common';
import type { IChatModelOption, IBotSettingsValues } from 'src/types/bot';

import { useState, useCallback } from 'react';

import {
  BOT_TOP_K_RANGE,
  BOT_TEMPERATURE_RANGE,
  BOT_INSTRUCTIONS_MAX_LENGTH,
} from 'src/shared/constants';

import { Card, Field, Input, Select, Textarea, CardHeader } from 'src/components/ui';

// ----------------------------------------------------------------------

/**
 * The slider covers the useful range of cosine similarities: below 0.3 almost anything
 * matches, above 0.9 almost nothing does.
 */
const SIMILARITY_SLIDER = { min: 0.3, max: 0.9, step: 0.01 };
const TEMPERATURE_STEP = 0.05;

type Props = {
  defaults: IBotSettingsValues;
  errors: FieldErrors;
  models: IChatModelOption[];
};

export function SettingsAnsweringCard({ defaults, errors, models }: Props) {
  const [threshold, setThreshold] = useState(defaults.minSimilarity);

  const handleThresholdChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setThreshold(Number(event.target.value)),
    []
  );

  return (
    <Card>
      <CardHeader
        title="Answering"
        description="Model, tone and how strict the bot is about staying grounded."
      />
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <Field
          label="Chat model"
          htmlFor="chatModel"
          error={errors.chatModel}
          hint="If it fails (rate limit, outage) DocsBot falls back to the next configured provider."
        >
          <Select id="chatModel" name="chatModel" defaultValue={defaults.chatModel}>
            {models.map((model) => (
              <option key={model.id} value={model.id} disabled={!model.available}>
                {model.label} ({model.provider}){model.available ? '' : ' — no API key'}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Creativity (temperature)"
          htmlFor="temperature"
          error={errors.temperature}
          hint="Keep low (0–0.3) for factual support answers. Ignored by Claude models."
        >
          <Input
            id="temperature"
            name="temperature"
            type="number"
            step={TEMPERATURE_STEP}
            min={BOT_TEMPERATURE_RANGE.min}
            max={BOT_TEMPERATURE_RANGE.max}
            defaultValue={defaults.temperature}
            className="w-28"
          />
        </Field>
        <div className="md:col-span-2">
          <Field
            label="Instructions & tone"
            htmlFor="instructions"
            error={errors.instructions}
            hint="E.g. “Friendly and concise. Recommend a subscription when relevant.” These can't override the grounding rules."
          >
            <Textarea
              id="instructions"
              name="instructions"
              defaultValue={defaults.instructions}
              rows={3}
              maxLength={BOT_INSTRUCTIONS_MAX_LENGTH}
            />
          </Field>
        </div>
        <Field
          label={`Confidence threshold: ${threshold.toFixed(2)}`}
          htmlFor="minSimilarity"
          error={errors.minSimilarity}
          hint="Minimum cosine similarity of the best matching passage. Below it the bot says it doesn't know. Higher = stricter."
        >
          <input
            id="minSimilarity"
            name="minSimilarity"
            type="range"
            min={SIMILARITY_SLIDER.min}
            max={SIMILARITY_SLIDER.max}
            step={SIMILARITY_SLIDER.step}
            value={threshold}
            onChange={handleThresholdChange}
            className="w-full accent-brand-600"
          />
        </Field>
        <Field
          label="Passages per answer"
          htmlFor="topK"
          error={errors.topK}
          hint={`How many retrieved chunks are given to the model (${BOT_TOP_K_RANGE.min}–${BOT_TOP_K_RANGE.max}).`}
        >
          <Input
            id="topK"
            name="topK"
            type="number"
            min={BOT_TOP_K_RANGE.min}
            max={BOT_TOP_K_RANGE.max}
            defaultValue={defaults.topK}
            className="w-28"
          />
        </Field>
      </div>
    </Card>
  );
}
