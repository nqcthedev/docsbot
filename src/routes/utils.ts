/**
 * Whether a navigation link points at the current page. Non-exact links also match their
 * sub-pages ("/dashboard/bots/1" is active on "/dashboard/bots/1/sources") but not siblings
 * that merely share a prefix ("/dashboard/bots/12").
 */
export function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
