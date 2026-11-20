import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/config-global';
import { AuthCenteredLayout } from 'src/layouts/auth-centered';

import { NotFoundView } from 'src/sections/error/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Page not found · ${CONFIG.appName}` };

export default function NotFound() {
  return (
    <AuthCenteredLayout>
      <NotFoundView backHref={paths.home} backLabel="Back to home" />
    </AuthCenteredLayout>
  );
}
