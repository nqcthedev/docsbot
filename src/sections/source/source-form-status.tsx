import type { FormState } from 'src/types/common';

import { getFieldErrors, getSuccessMessage } from 'src/utils/form-state';

import { Alert } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  state: FormState;
};

/** Form-level outcome of an add-source form; field errors render next to their inputs. */
export function SourceFormStatus({ state }: Props) {
  const formError = getFieldErrors(state).form;
  const successMessage = getSuccessMessage(state);

  if (formError) return <Alert tone="red">{formError}</Alert>;
  if (successMessage) return <Alert tone="green">{successMessage}</Alert>;
  return null;
}
