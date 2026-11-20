'use client';

import { usePathname } from 'next/navigation';

import { isActivePath } from 'src/routes/utils';

// ----------------------------------------------------------------------

export function useActiveLink(href: string, exact = false) {
  const pathname = usePathname();
  return isActivePath(pathname, href, exact);
}
