import { getCurrentUser } from 'src/server/auth/session';

import { HomeView } from 'src/sections/home/view';

// ----------------------------------------------------------------------

// The header and calls to action depend on the session cookie.
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  return <HomeView isSignedIn={Boolean(user)} />;
}
