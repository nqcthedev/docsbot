'use client';

import { useActionState } from 'react';

import { useResetFormOnSuccess } from 'src/hooks/use-reset-form-on-success';

import { getFieldErrors } from 'src/utils/form-state';

import { addPdfSource } from 'src/actions/source';

import { Field, Input, Button } from 'src/components/ui';

import { SourceFormStatus } from './source-form-status';

// ----------------------------------------------------------------------

type Props = {
  botId: string;
  maxUploadMb: number;
};

export function SourcePdfForm({ botId, maxUploadMb }: Props) {
  const [state, formAction, isPending] = useActionState(addPdfSource.bind(null, botId), undefined);
  const formRef = useResetFormOnSuccess(state);
  const errors = getFieldErrors(state);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <Field
        label="PDF file"
        htmlFor="file"
        error={errors.file}
        hint={`Text-based PDFs up to ${maxUploadMb} MB. Answers cite the page number.`}
      >
        <Input
          id="file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
          className="h-auto py-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm"
        />
      </Field>
      <SourceFormStatus state={state} />
      <Button type="submit" variant="brand" disabled={isPending}>
        {isPending ? 'Uploading…' : 'Upload PDF'}
      </Button>
    </form>
  );
}
