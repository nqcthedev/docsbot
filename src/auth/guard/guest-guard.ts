import 'server-only';

import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

import { getCurrentUser } from 'src/server/auth/session';

// ----------------------------------------------------------------------

/** Login and sign-up are for visitors: a signed-in user goes straight to the dashboard. */
export async function redirectIfAuthenticated() {
  if (await getCurrentUser()) redirect(paths.dashboard.root);
}
