"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SidebarLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
      )}
    >
      {children}
    </Link>
  );
}

export function TabNav({ base, tabs }: { base: string; tabs: { href: string; label: string; count?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-zinc-200">
      {tabs.map((t) => {
        const href = base + t.href;
        const active = t.href === "" ? path === base : path === href || path.startsWith(href + "/");
        return (
          <Link
            key={t.href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              active ? "border-brand-600 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900",
            )}
          >
            {t.label}
            {t.count ? <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-600">{t.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
