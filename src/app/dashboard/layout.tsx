import { desc, eq } from "drizzle-orm";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SidebarLink } from "@/components/nav";
import { requireUser } from "@/server/data";
import { getDb } from "@/server/db";
import { bots } from "@/server/db/schema";
import { logout } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const botList = await db.select({ id: bots.id, name: bots.name, brandColor: bots.brandColor }).from(bots).where(eq(bots.workspaceId, user.workspaceId)).orderBy(desc(bots.createdAt));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 md:flex">
        <Logo href="/dashboard" className="px-2" />
        <div className="mt-6 px-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{user.workspaceName}</div>
        <nav className="mt-2 space-y-0.5">
          <SidebarLink href="/dashboard" exact>
            All bots
          </SidebarLink>
          {botList.map((b) => (
            <SidebarLink key={b.id} href={`/dashboard/bots/${b.id}`}>
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: b.brandColor }} />
              <span className="truncate">{b.name}</span>
            </SidebarLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-zinc-100 pt-3">
          <div className="px-2">
            <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          <form action={logout} className="mt-2">
            <button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
              <LogOut className="size-4" /> Log out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 md:hidden">
          <Logo href="/dashboard" />
          <Link href="/dashboard" className="text-sm text-zinc-600">
            Bots
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
