"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Award, Bell, BookOpen, Building2, Calendar, ChartColumn, Compass, Gavel, GraduationCap, KeyRound, LayoutDashboard,
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
  if (href === "/app") return pathname === "/app";
  if (href === "/app/admin") return pathname === "/app/admin";
  if (href === "/app/events") return pathname === "/app/events" || (pathname.startsWith("/app/events/") && !pathname.startsWith("/app/events/new"));
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-6">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="eyebrow mb-2 px-3 !text-[0.6rem] text-muted">{g.title}</div>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = ICONS[it.icon] ?? LayoutDashboard;
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                      active ? "bg-card text-ink shadow-[0_1px_0_var(--color-line)]" : "text-ink-2 hover:bg-card/60 hover:text-ink",
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-brand" />}
                    <Icon className={cn("h-4 w-4", active ? "text-brand" : "text-muted")} />
                    <span className="flex-1">{it.label}</span>
                    {it.badge ? <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{it.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppSidebar({ groups }: { groups: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-line bg-paper-2/70 px-3 py-5 lg:block">
        <div className="mb-7 px-3">
          <Wordmark href="/app" size="sm" subtitle="Ecosystem OS" />
        </div>
        <NavList groups={groups} />
      </aside>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-40 rounded-full bg-ink p-3 text-white shadow-lg lg:hidden" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-paper px-3 py-5 shadow-xl">
            <div className="mb-6 flex items-center justify-between px-3">
              <Wordmark href="/app" size="sm" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
