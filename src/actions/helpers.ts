import 'server-only';

import type { ZodError } from 'zod';
import type { FormState } from 'src/types/common';

import { after } from 'next/server';

import { fieldErrors } from 'src/server/validation';
import { drainIngestQueue } from 'src/server/ingest/queue';

// ----------------------------------------------------------------------

/** A text field of a submitted form ('' when missing; a file in a text field is not text). */
export function formText(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value : '';
}

// ----------------------------------------------------------------------

export function invalid(error: ZodError, values?: Record<string, string>): FormState {
  return { ok: false, errors: fieldErrors(error), values };
}

// ----------------------------------------------------------------------

/** Kicks the ingestion queue after the response is sent (works on Node servers and Vercel). */
export function scheduleIngestion() {
  after(async () => {
    await drainIngestQueue();
  });
}
