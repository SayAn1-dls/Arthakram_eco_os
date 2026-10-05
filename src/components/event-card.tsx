import Link from "next/link";
import type { events } from "@/db/schema";
import { Badge, StatusBadge } from "./ui";
import { fmtDate, humanize } from "@/lib/format";

export function EventCard({ e, club }: { e: typeof events.$inferSelect; club?: string }) {
  return (
    <Link href={`/events/${e.slug}`} className={`group flex flex-col rounded-[var(--radius-card)] border p-5 transition-colors hover:border-brand ${e.status === "live" ? "border-brand bg-brand-wash/50" : "border-line bg-card"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={e.status} />
        <span className="text-xs text-muted">{humanize(e.type)}</span>
      </div>
      <div className="mt-3 text-lg font-extrabold leading-tight text-ink group-hover:text-brand-deep">{e.title}</div>
      {club && <div className="text-xs font-semibold text-ink-2">{club}</div>}
      <p className="mt-2 flex-1 text-sm text-muted">{e.tagline}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-ink-2">
          {fmtDate(e.startsAt)} · {humanize(e.mode)}
        </span>
        {e.registrationOpen ? <Badge tone="ok">Registration open</Badge> : e.resultsPublished ? <Badge tone="ink">Results out</Badge> : null}
      </div>
    </Link>
  );
}
