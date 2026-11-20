import { paths } from 'src/routes/paths';

import { NotFoundView } from 'src/sections/error/view';

// ----------------------------------------------------------------------

/** Unknown bots and conversations (including other workspaces') land here, inside the dashboard. */
export default function NotFound() {
  return <NotFoundView backHref={paths.dashboard.root} backLabel="Back to your bots" />;
}
