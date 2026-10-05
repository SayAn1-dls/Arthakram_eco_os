import Link from "next/link";
import { Bell, LogOut, Search } from "lucide-react";
import { requireUser } from "@/server/auth";
import { buildNav } from "@/server/nav";
import { logout } from "@/server/actions/auth";
import { AppSidebar, MobileMenu } from "@/components/app-sidebar";
import { Avatar } from "@/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { groups, roles, unread } = await buildNav(user.id);
  return (
    <div className="flex min-h-screen">
      <AppSidebar groups={groups} />
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-paper/90 px-3 backdrop-blur sm:gap-3 sm:px-6">
          <MobileMenu groups={groups} />
          <form action="/app/search" role="search" className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              placeholder="Search events, clubs, people, documents"
              aria-label="Search"
              className="h-9 w-full rounded-lg border border-line bg-card pl-9 pr-3 text-sm placeholder:text-muted/80 focus:border-brand focus:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/" className="hidden rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-paper-2 sm:block">
              Public site
            </Link>
            <Link href="/app/notifications" className="relative rounded-md p-2 text-ink-2 hover:bg-paper-2" aria-label={`${unread} unread notifications`}>
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[11px] font-bold leading-[18px] text-white ring-2 ring-paper">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1 hover:bg-paper-2">
                <Avatar name={user.name} size={28} />
                <span className="hidden text-left sm:block">
                  <span className="block text-[13px] font-semibold leading-tight text-ink">{user.name}</span>
                  <span className="block max-w-40 truncate text-[11px] leading-tight text-muted">{roles.join(" · ") || "Member"}</span>
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-line bg-card p-2 shadow-lg">
                <div className="px-2 py-1.5 text-xs text-muted">{user.email}</div>
                <Link href="/app/profile" className="block rounded-md px-2 py-1.5 text-sm hover:bg-paper-2">
                  Edit profile
                </Link>
                <Link href="/app/path" className="block rounded-md px-2 py-1.5 text-sm hover:bg-paper-2">
                  My path
                </Link>
                <Link href="/app/access" className="block rounded-md px-2 py-1.5 text-sm hover:bg-paper-2">
                  My access
                </Link>
                <form action={logout}>
                  <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-bad hover:bg-red-50">
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
