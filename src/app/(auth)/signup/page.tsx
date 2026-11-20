import { redirect } from 'next/navigation';

import { SignupForm } from 'src/app/(auth)/auth-forms';
import { getCurrentUser } from 'src/server/auth/session';

export const metadata = { title: 'Sign up' };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  return <SignupForm />;
}
