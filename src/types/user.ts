import type { CurrentUser } from 'src/server/auth/session';

// ----------------------------------------------------------------------

/** The signed-in user and their workspace, as resolved from the session cookie. */
export type ISessionUser = CurrentUser;

/** What the dashboard chrome shows about the signed-in account. */
export type IAccountSummary = Pick<ISessionUser, 'name' | 'email' | 'workspaceName'>;
