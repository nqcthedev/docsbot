'use client';

import { useActionState } from 'react';

import { useResetFormOnSuccess } from 'src/hooks/use-reset-form-on-success';

import { getFieldErrors } from 'src/utils/form-state';

import { addTextSource } from 'src/actions/source';

import { Field, Input, Button, Textarea } from 'src/components/ui';

import { SourceFormStatus } from './source-form-status';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
};

export function SourceTextForm({ botId }: Props) {
  const [state, formAction, isPending] = useActionState(addTextSource.bind(null, botId), undefined);
  const formRef = useResetFormOnSuccess(state);
  const errors = getFieldErrors(state);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <Field label="Title" htmlFor="name" error={errors.name}>
        <Input id="name" name="name" placeholder="e.g. Holiday opening hours" required />
      </Field>
      <Field
        label="Content"
        htmlFor="text"
        error={errors.text}
        hint="Markdown headings (#, ##) are used as section context."
      >
        <Textarea
          id="text"
          name="text"
          rows={8}
          placeholder={'# Holiday hours\n\nWe are closed on December 25 and January 1.'}
          required
        />
      </Field>
      <SourceFormStatus state={state} />
      <Button type="submit" variant="brand" disabled={isPending}>
        {isPending ? 'Saving…' : 'Add text'}
      </Button>
    </form>
  );
}
