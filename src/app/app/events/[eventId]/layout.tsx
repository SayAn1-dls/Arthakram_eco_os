import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { EVENT_TABS, eventAccess, eventContext } from "@/server/events";
import { EventTabs } from "@/components/event-tabs";
import { Forbidden, StatusBadge } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export default async function EventWorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, has } = await eventAccess(eventId);
  if (!has("events.view")) return <Forbidden message="This event workspace is only open to people the organizers or admins have given access to." />;
  const ctx = eventContext(event);
  const tabs = EVENT_TABS.filter((t) => has(t.perm));
  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Link href="/app/events" className="hover:text-brand-deep">
            Event workspaces
          </Link>
          <span>/</span>
          <span>{ctx.org?.name}</span>
          {ctx.club && (
            <>
              <span>/</span>
              <span>{ctx.club.name}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-tight">{event.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <StatusBadge status={event.status} />
              <span>{humanize(event.type)}</span>
              <span>·</span>
              <span>
                {fmtDate(event.startsAt)} – {fmtDate(event.endsAt)}
              </span>
              {event.venue && (
                <>
                  <span>·</span>
                  <span>{event.venue}</span>
                </>
              )}
            </div>
          </div>
          {event.status !== "draft" && event.visibility === "public" && (
            <Link href={`/events/${event.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-deep hover:underline">
              Public page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
      <div className="mb-8 border-b border-line">
        <EventTabs base={`/app/events/${eventId}`} tabs={tabs.map(({ href, label }) => ({ href, label }))} />
      </div>
      {children}
    </div>
  );
}
