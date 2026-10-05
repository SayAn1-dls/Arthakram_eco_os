import { and, asc, eq, gt } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/db";
import { events, opportunities } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Opportunities" };

export default async function PublicOpportunities({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const user = await getCurrentUser();
  const slugs = new Map(db.select({ id: events.id, slug: events.slug }).from(events).all().map((e) => [e.id, e.slug]));
  let list = db.select().from(opportunities).where(and(eq(opportunities.status, "active"), gt(opportunities.deadline, new Date()))).orderBy(asc(opportunities.deadline)).all();
  const cats = [...new Set(list.map((o) => o.category))];
  if (category) list = list.filter((o) => o.category === category);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Opportunities"
        title="Hackathons, cases, MUNs, fellowships & more"
        description="From Arthakram events and trusted external platforms. External listings take you to the original registration page."
        actions={<LinkButton href={user ? "/app/opportunities" : "/signup"}>{user ? "See my matches" : "Get personalised matches"}</LinkButton>}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <a href="?" className={cn("rounded-full border px-3 py-1 text-sm font-semibold", !category ? "border-brand bg-brand text-white" : "border-line bg-card")}>All</a>
        {cats.map((c) => (
          <a key={c} href={`?category=${c}`} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", category === c ? "border-brand bg-brand text-white" : "border-line bg-card")}>{humanize(c)}</a>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((o) => {
          const href = o.eventId ? `/events/${slugs.get(o.eventId)}` : o.sourceUrl;
          return (
            <Card key={o.id}>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="brand">{humanize(o.category)}</Badge>
                <Badge>{o.source === "arthakram" ? "On Arthakram" : `Source: ${humanize(o.source)}`}</Badge>
              </div>
              <h3 className="mt-3 text-lg font-bold text-ink">{o.title}</h3>
              <div className="text-sm text-muted">{o.organizer}</div>
              {o.description && <p className="mt-2 text-sm text-ink-2">{o.description}</p>}
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-2">Registration deadline: {fmtDate(o.deadline)}</span>
                {href && (
                  <a href={href} target={o.eventId ? undefined : "_blank"} rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-brand-deep hover:underline">
                    View opportunity {!o.eventId && <ExternalLink className="h-3 w-3" />}
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
