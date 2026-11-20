import 'server-only';

import type { IBotItem } from 'src/types/bot';
import type { ISessionUser } from 'src/types/user';

import { notFound, redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

import { findWorkspaceBot } from 'src/server/data';
import { entityIdSchema } from 'src/server/validation';
import { getCurrentUser } from 'src/server/auth/session';

// ----------------------------------------------------------------------

/**
 * The signed-in user, or a redirect to the login page. The middleware only checks that a
 * session cookie exists; this validates it against the database.
 */
export async function requireUser(): Promise<ISessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(paths.auth.login);
  return user;
}

// ----------------------------------------------------------------------

/**
 * A bot owned by the signed-in user's workspace. Unknown ids and other tenants' bots both
 * 404, so the response never reveals whether a bot exists.
 */
export async function requireBot(botId: string): Promise<{ user: ISessionUser; bot: IBotItem }> {
  const user = await requireUser();
  if (!entityIdSchema.safeParse(botId).success) notFound();
  const bot = await findWorkspaceBot(botId, user.workspaceId);
  if (!bot) notFound();
  return { user, bot };
}
