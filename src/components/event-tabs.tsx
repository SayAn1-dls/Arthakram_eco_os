"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function EventTabs({ base, tabs }: { base: string; tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="no-print -mx-1 flex gap-x-1 gap-y-2 overflow-x-auto pb-1 [scrollbar-width:thin] xl:flex-wrap xl:overflow-visible">
      {tabs.map((t) => {
        const href = base + t.href;
        const active = t.href === "" ? pathname === base : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={t.href}
            href={href}
            className={cn(
              "relative whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-semibold transition-colors",
              active ? "text-ink" : "text-muted hover:bg-paper-2 hover:text-ink",
            )}
          >
            {t.label}
            {active && <span className="absolute inset-x-3 -bottom-1 h-[3px] rounded bg-brand" />}
          </Link>
        );
      })}
    </nav>
  );
}
