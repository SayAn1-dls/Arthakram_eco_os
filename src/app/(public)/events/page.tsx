import { publicEvents, clubNames } from "@/server/public";
import { EventCard } from "@/components/event-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Events" };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ type?: string; when?: string }> }) {
  const { type, when } = await searchParams;
  let list = publicEvents();
  const types = [...new Set(list.map((e) => e.type))];
  if (type) list = list.filter((e) => e.type === type);
  if (when === "upcoming") list = list.filter((e) => ["live", "published"].includes(e.status));
  if (when === "past") list = list.filter((e) => ["completed", "archived"].includes(e.status));
  const clubs = clubNames();
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1 text-sm font-semibold", active ? "border-brand bg-brand text-white" : "border-line bg-card hover:border-brand");
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Events" title="Events across the ecosystem" description="Hackathons, cases, MUNs, workshops and more — run on Arthakram by clubs and organizations." />
      <div className="mb-8 flex flex-wrap gap-2">
        <a href="?" className={chip(!type && !when)}>All</a>
        <a href="?when=upcoming" className={chip(when === "upcoming")}>Live & upcoming</a>
        <a href="?when=past" className={chip(when === "past")}>Past</a>
        {types.map((t) => (
          <a key={t} href={`?type=${t}`} className={chip(type === t)}>
            {humanize(t)}
          </a>
        ))}
      </div>
      {list.length === 0 ? <EmptyState title="No events match" /> : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map((e) => <EventCard key={e.id} e={e} club={e.clubId ? clubs.get(e.clubId) : undefined} />)}
        </div>
      )}
    </div>
  );
}
