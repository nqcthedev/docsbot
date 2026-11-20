import { CONFIG } from 'src/config-global';

import { SignupView } from 'src/auth/view';
import { redirectIfAuthenticated } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Sign up · ${CONFIG.appName}` };

export default async function Page() {
  await redirectIfAuthenticated();
  return <SignupView />;
}
