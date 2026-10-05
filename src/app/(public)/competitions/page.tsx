import { COMPETITION_TYPES, clubNames, publicEvents } from "@/server/public";
import { EventCard } from "@/components/event-card";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Competitions" };

export default async function CompetitionsPage() {
  const list = publicEvents({ types: COMPETITION_TYPES });
  const clubs = clubNames();
  const open = list.filter((e) => ["live", "published"].includes(e.status));
  const past = list.filter((e) => !["live", "published"].includes(e.status));
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Competitions" title="Compete. Get judged. Get better." description="Product, consulting, coding, AI, design, startup, MUN and debate competitions — scored on published rubrics by real judges." actions={<LinkButton href="/opportunities" variant="outline">External opportunities</LinkButton>} />
      <h2 className="eyebrow mb-4">Open now</h2>
      {open.length ? <div className="mb-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{open.map((e) => <EventCard key={e.id} e={e} club={e.clubId ? clubs.get(e.clubId) : undefined} />)}</div> : <EmptyState title="Nothing open right now" />}
      <h2 className="eyebrow mb-4">Past competitions</h2>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{past.map((e) => <EventCard key={e.id} e={e} club={e.clubId ? clubs.get(e.clubId) : undefined} />)}</div>
    </div>
  );
}
