import type { FormState, FieldErrors } from 'src/types/common';

// ----------------------------------------------------------------------

const NO_ERRORS: FieldErrors = {};

export function getFieldErrors(state: FormState): FieldErrors {
  return state && !state.ok ? state.errors : NO_ERRORS;
}

// ----------------------------------------------------------------------

export function getSubmittedValue(state: FormState, field: string): string | undefined {
  return state && !state.ok ? state.values?.[field] : undefined;
}

// ----------------------------------------------------------------------

export function getSuccessMessage(state: FormState): string | undefined {
  return state?.ok ? state.message : undefined;
}
