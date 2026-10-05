"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Menu" className="rounded-md p-2 text-ink hover:bg-paper-2">
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-[76px] z-40 border-b border-line bg-paper px-4 py-3 shadow-lg">
          {items.map((i) => (
            <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2.5 font-medium text-ink-2 hover:bg-paper-2">
              {i.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
