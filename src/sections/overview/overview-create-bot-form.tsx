'use client';

import { Plus } from 'lucide-react';
import { useActionState } from 'react';

import { getFieldErrors } from 'src/utils/form-state';

import { createBot } from 'src/actions/bot';
import { BOT_NAME_MAX_LENGTH } from 'src/shared/constants';

import { Input, Button } from 'src/components/ui';

// ----------------------------------------------------------------------

export function OverviewCreateBotForm() {
  const [state, formAction, isPending] = useActionState(createBot, undefined);
  const errors = getFieldErrors(state);

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div>
        <Input
          name="name"
          placeholder="Bot name, e.g. Support Assistant"
          aria-label="Bot name"
          className="w-64"
          required
          maxLength={BOT_NAME_MAX_LENGTH}
        />
        {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
      </div>
      <Button type="submit" variant="brand" disabled={isPending}>
        <Plus /> {isPending ? 'Creating…' : 'New bot'}
      </Button>
    </form>
  );
}
