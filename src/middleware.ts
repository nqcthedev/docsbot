import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { paths } from 'src/routes/paths';

import { SESSION_COOKIE } from 'src/server/auth/constants';

// ----------------------------------------------------------------------

/**
 * Cheap edge check: visitors without a session cookie are sent to the login page before any
 * rendering. The session itself is validated against the database by the auth guards
 * (src/auth/guard), so a forged cookie gets nowhere.
 */
export function middleware(request: NextRequest) {
  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = paths.auth.login;
    loginUrl.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

// Must be a static literal (Next.js reads it at build time), so it cannot use `paths`.
export const config = { matcher: ['/dashboard/:path*'] };
