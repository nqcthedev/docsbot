/** Validation messages keyed by form field; `form` holds errors that belong to no single field. */
export type FieldErrors = Record<string, string | undefined>;

/**
 * What every form server action returns: a success (with an optional confirmation message)
 * or the field errors plus the submitted values, so the form can be shown again as typed.
 */
export type FormResult =
  | { ok: true; message?: string }
  | { ok: false; errors: FieldErrors; values?: Record<string, string> };

/** `useActionState` state: undefined until the form is first submitted. */
export type FormState = FormResult | undefined;
