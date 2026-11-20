'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { paths } from 'src/routes/paths';

import { getFieldErrors, getSubmittedValue } from 'src/utils/form-state';

import { signup } from 'src/actions/auth';
import { PASSWORD_MIN_LENGTH } from 'src/shared/constants';

import { Card, Alert, Field, Input, Button } from 'src/components/ui';

// ----------------------------------------------------------------------

export function SignupView() {
  const [state, formAction, isPending] = useActionState(signup, undefined);
  const errors = getFieldErrors(state);

  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-500">Train your first bot in a few minutes.</p>
      <form action={formAction} className="mt-6 space-y-4" noValidate>
        {errors.form ? <Alert tone="red">{errors.form}</Alert> : null}
        <Field label="Name" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            defaultValue={getSubmittedValue(state, 'name')}
          />
        </Field>
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
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
          />
        </Field>
        <Button type="submit" variant="brand" className="w-full" disabled={isPending}>
          {isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link className="font-medium text-brand-600 hover:underline" href={paths.auth.login}>
          Log in
        </Link>
      </p>
    </Card>
  );
}
