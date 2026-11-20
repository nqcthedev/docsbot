'use client';

import { useActionState } from 'react';

import { useResetFormOnSuccess } from 'src/hooks/use-reset-form-on-success';

import { getFieldErrors } from 'src/utils/form-state';

import { addWebsiteSource } from 'src/actions/source';
import { DEFAULT_CRAWL_MAX_PAGES } from 'src/shared/constants';

import { Field, Input, Button } from 'src/components/ui';

import { SourceFormStatus } from './source-form-status';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  /** Deployment-wide crawl limit (CRAWLER_MAX_PAGES). */
  maxPagesCap: number;
};

export function SourceWebsiteForm({ botId, maxPagesCap }: Props) {
  const [state, formAction, isPending] = useActionState(
    addWebsiteSource.bind(null, botId),
    undefined
  );
  const formRef = useResetFormOnSuccess(state);
  const errors = getFieldErrors(state);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <Field
        label="Website URL"
        htmlFor="url"
        error={errors.url}
        hint="We read sitemap.xml when available, follow same-site links, and respect robots.txt."
      >
        <Input id="url" name="url" type="url" placeholder="https://example.com" required />
      </Field>
      <Field
        label="Page limit"
        htmlFor="maxPages"
        error={errors.maxPages}
        hint={`Up to ${maxPagesCap} pages.`}
      >
        <Input
          id="maxPages"
          name="maxPages"
          type="number"
          min={1}
          max={maxPagesCap}
          defaultValue={Math.min(DEFAULT_CRAWL_MAX_PAGES, maxPagesCap)}
          className="w-28"
        />
      </Field>
      <SourceFormStatus state={state} />
      <Button type="submit" variant="brand" disabled={isPending}>
        {isPending ? 'Adding…' : 'Crawl website'}
      </Button>
    </form>
  );
}
