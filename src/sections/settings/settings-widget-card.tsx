import type { FieldErrors } from 'src/types/common';
import type { IBotSettingsValues } from 'src/types/bot';

import { Card, Field, Textarea, CardHeader } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  defaults: IBotSettingsValues;
  errors: FieldErrors;
};

export function SettingsWidgetCard({ defaults, errors }: Props) {
  return (
    <Card>
      <CardHeader title="Widget security & leads" />
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <Field
          label="Allowed domains"
          htmlFor="allowedDomains"
          error={errors.allowedDomains}
          hint="One per line, e.g. example.com, *.example.com or localhost:3000. Empty = any site (not recommended)."
        >
          <Textarea
            id="allowedDomains"
            name="allowedDomains"
            defaultValue={defaults.allowedDomains}
            rows={4}
            className="font-mono"
            placeholder="example.com"
          />
        </Field>
        <div className="space-y-1.5">
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3">
            <input
              type="checkbox"
              name="leadCaptureEnabled"
              defaultChecked={defaults.leadCaptureEnabled}
              className="mt-0.5 size-4 accent-brand-600"
            />
            <span>
              <span className="block text-sm font-medium">Lead capture</span>
              <span className="block text-xs text-zinc-500">
                Offer an email form when the bot can&apos;t answer or the visitor asks for a human.
              </span>
            </span>
          </label>
        </div>
      </div>
    </Card>
  );
}
