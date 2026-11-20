import { redirect } from 'next/navigation';

import { LoginForm } from 'src/app/(auth)/auth-forms';
import { getCurrentUser } from 'src/server/auth/session';

export const metadata = { title: 'Log in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect('/dashboard');
  const { next } = await searchParams;
  return <LoginForm next={next} />;
}
