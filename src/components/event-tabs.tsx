"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type Tab = { href: string; label: string; group: string };

/**
 * Event workspace navigation. Wide screens: tabs grouped by task.
 * Phones: one dropdown, so nothing hides off-screen.
 */
export function EventTabs({ base, tabs }: { base: string; tabs: Tab[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (t: Tab) => (t.href === "" ? pathname === base : pathname === base + t.href || pathname.startsWith(base + t.href + "/"));
  const groups = [...new Set(tabs.map((t) => t.group))];
  const current = tabs.find(isActive);
  return (
    <>
      <label className="block md:hidden">
        <span className="sr-only">Workspace section</span>
        <select
          value={current?.href ?? ""}
          onChange={(e) => router.push(base + e.target.value)}
          className="h-11 w-full rounded-lg border border-line bg-white px-3 text-[15px] font-semibold"
        >
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {tabs
                .filter((t) => t.group === g)
                .map((t) => (
                  <option key={t.href} value={t.href}>
                    {t.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <nav className="no-print hidden flex-wrap gap-x-6 gap-y-3 md:flex" aria-label="Event workspace">
        {groups.map((g) => (
          <div key={g} className="flex items-center gap-0.5">
            <span className="mr-1.5 text-[12px] font-semibold text-muted">{g}</span>
            {tabs
              .filter((t) => t.group === g)
              .map((t) => {
                const active = isActive(t);
                return (
                  <Link
                    key={t.href}
                    href={base + t.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "whitespace-nowrap rounded-md px-2.5 py-1.5 text-[14px] transition-colors",
                      active ? "bg-ink font-semibold text-white" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                    )}
                  >
                    {t.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
    </>
  );
}
