import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap edge check: unauthenticated visitors are redirected away from the dashboard before
 * rendering. The session itself is validated against the database in server components and
 * actions (see server/auth/session.ts) — a forged cookie gets nowhere.
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("docsbot_session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
