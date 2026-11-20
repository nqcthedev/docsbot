"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { login, signup } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Welcome back</h1>
      <p className="mt-1 text-sm text-zinc-500">Log in to manage your bots.</p>
      <form action={action} className="mt-6 space-y-4" noValidate>
        {state?.errors?.form ? <Alert tone="red">{state.errors.form}</Alert> : null}
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" htmlFor="email" error={state?.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={state?.errors?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" variant="brand" className="w-full" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        New to DocsBot?{" "}
        <Link className="font-medium text-brand-600 hover:underline" href="/signup">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-500">Train your first bot in a few minutes.</p>
      <form action={action} className="mt-6 space-y-4" noValidate>
        {state?.errors?.form ? <Alert tone="red">{state.errors.form}</Alert> : null}
        <Field label="Name" htmlFor="name" error={state?.errors?.name}>
          <Input id="name" name="name" autoComplete="name" required defaultValue={state?.values?.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={state?.errors?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={state?.errors?.password} hint="At least 8 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Button type="submit" variant="brand" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link className="font-medium text-brand-600 hover:underline" href="/login">
          Log in
        </Link>
      </p>
    </Card>
  );
}
