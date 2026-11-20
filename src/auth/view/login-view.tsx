'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { paths } from 'src/routes/paths';

import { getFieldErrors, getSubmittedValue } from 'src/utils/form-state';

import { login } from 'src/actions/auth';

import { Card, Alert, Field, Input, Button } from 'src/components/ui';

// ----------------------------------------------------------------------

type Props = {
  /** Dashboard path to return to after logging in (validated again by the action). */
  next?: string;
};

export function LoginView({ next }: Props) {
  const [state, formAction, isPending] = useActionState(login, undefined);
  const errors = getFieldErrors(state);

  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-zinc-500">Log in to manage your bots.</p>
      <form action={formAction} className="mt-6 space-y-4" noValidate>
        {errors.form ? <Alert tone="red">{errors.form}</Alert> : null}
        <input type="hidden" name="next" value={next ?? ''} />
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={getSubmittedValue(state, 'email')}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" variant="brand" className="w-full" disabled={isPending}>
          {isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        New to DocsBot?{' '}
        <Link className="font-medium text-brand-600 hover:underline" href={paths.auth.signup}>
          Create an account
        </Link>
      </p>
    </Card>
  );
}
