'use client';

import type { FormState } from 'src/types/common';

import { useRef, useEffect } from 'react';

// ----------------------------------------------------------------------

/**
 * Clears a form after each successful submission so the next entry starts empty. Keyed on
 * the state object, not on `ok`, so two successes in a row both reset.
 */
export function useResetFormOnSuccess(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return formRef;
}
