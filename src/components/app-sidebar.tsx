"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Award, Bell, BookOpen, Building2, Calendar, ChartColumn, ChevronDown, Compass, Gavel, GraduationCap, KeyRound, LayoutDashboard,
  Menu, MessageSquare, Plus, ScrollText, Settings, Shield, Sparkles, Ticket, User, Users, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavGroup } from "@/server/nav";
import { Wordmark } from "./logo";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  layout: LayoutDashboard, compass: Compass, sparkles: Sparkles, ticket: Ticket, users: Users, message: MessageSquare,
  badge: Award, bell: Bell, calendar: Calendar, plus: Plus, gavel: Gavel, graduation: GraduationCap, shield: Shield,
  user: User, key: KeyRound, building: Building2, book: BookOpen, chart: ChartColumn, scroll: ScrollText, settings: Settings,
};

function isActive(pathname: string, href: string) {
  if (href === "/app" || href === "/app/admin") return pathname === href;
  if (href === "/app/events") return pathname === "/app/events" || (pathname.startsWith("/app/events/") && !pathname.startsWith("/app/events/new"));
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <nav className="space-y-5" aria-label="Main">
      {groups.map((g) => {
        const containsActive = g.items.some((it) => isActive(pathname, it.href));
        const expanded = !g.collapsible || (open[g.title] ?? containsActive);
        return (
          <div key={g.title}>
            {g.collapsible ? (
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [g.title]: !expanded }))}
                className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1 text-[13px] font-semibold text-muted hover:text-ink"
                aria-expanded={expanded}
              >
                {g.title}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              </button>
            ) : (
              <div className="mb-1 px-3 text-[13px] font-semibold text-muted">{g.title}</div>
            )}
            {expanded && (
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const Icon = ICONS[it.icon] ?? LayoutDashboard;
                  const active = isActive(pathname, it.href);
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[14.5px] transition-colors",
                          active ? "bg-card font-semibold text-ink shadow-[inset_3px_0_0_var(--color-brand)]" : "text-ink-2 hover:bg-card/70 hover:text-ink",
                        )}
                      >
                        <Icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-brand" : "text-muted")} />
                        <span className="flex-1 truncate">{it.label}</span>
                        {it.badge ? <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{it.badge}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function AppSidebar({ groups }: { groups: NavGroup[] }) {
  return (
    <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto border-r border-line bg-paper-2/60 px-3 pb-6 pt-4 lg:block">
      <div className="mb-6 px-2">
        <Wordmark href="/app" size="sm" priority />
      </div>
      <NavList groups={groups} />
    </aside>
  );
}

/** Menu button shown in the top bar on phones and tablets; opens the same navigation as a drawer. */
export function MobileMenu({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} className="-ml-1 rounded-md p-2 text-ink hover:bg-paper-2" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-paper px-3 pb-6 pt-4 shadow-xl">
            <div className="mb-6 flex items-center justify-between px-2">
              <Wordmark href="/app" size="sm" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-1.5 hover:bg-paper-2">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
