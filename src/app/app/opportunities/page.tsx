import { ExternalLink } from "lucide-react";
import { requireUser } from "@/server/auth";
import { recommendedOpportunities, signalsFor } from "@/server/student";
import { toggleSaveOpportunity } from "@/server/actions/student";
import { ActionButton } from "@/components/forms";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { fmtDate, fmtRelative, humanize } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Opportunities for you" };

export default async function OpportunityFeed({ searchParams }: { searchParams: Promise<{ category?: string; saved?: string }> }) {
  const { category, saved } = await searchParams;
  const user = await requireUser();
  const s = signalsFor(user.id);
  let list = recommendedOpportunities(user.id, 100);
  const cats = [...new Set(list.map((x) => x.o.category))];
  if (category) list = list.filter((x) => x.o.category === category);
  if (saved) list = list.filter((x) => x.saved);
  const personal = s.interests.length + s.skills.length + Object.keys(s.dimensions).length > 0;
  return (
    <>
      <PageHeader
        eyebrow="Opportunities"
        title="Recommended for you"
        description={personal ? "Ranked by your interests, skills, assessment, clubs and past competitions — every match explains itself." : "Add interests to your profile or take Find My Club to personalise this feed."}
        actions={!personal ? <LinkButton href="/app/profile">Personalise</LinkButton> : null}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <a href="/app/opportunities" className={cn("rounded-full border px-3 py-1 text-sm font-semibold", !category && !saved ? "border-brand bg-brand text-white" : "border-line bg-card")}>
          All
        </a>
        <a href="?saved=1" className={cn("rounded-full border px-3 py-1 text-sm font-semibold", saved ? "border-brand bg-brand text-white" : "border-line bg-card")}>
          Saved
        </a>
        {cats.map((c) => (
          <a key={c} href={`?category=${c}`} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", category === c ? "border-brand bg-brand text-white" : "border-line bg-card")}>
            {humanize(c)}
          </a>
        ))}
      </div>
      {list.length === 0 && <EmptyState title="Nothing here yet" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {list.map(({ o, score, reasons, saved: isSaved, href }) => (
          <Card key={o.id} className="scroll-mt-20" >
            <div id={o.id} className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-brand text-white">
                <span className="text-xl font-bold leading-none">{score}%</span>
                <span className="mt-0.5 text-[9px] font-bold tracking-widest">MATCH</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">{humanize(o.category)}</Badge>
                  <Badge>{o.source === "arthakram" ? "On Arthakram" : `Source: ${humanize(o.source)}`}</Badge>
                  {o.featured && <Badge tone="ink">Featured</Badge>}
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug text-ink">{o.title}</h3>
                <div className="text-sm text-muted">
                  {o.organizer} · {humanize(o.mode)}
                  {o.location && ` · ${o.location}`}
                </div>
              </div>
            </div>
            {o.description && <p className="mt-3 text-sm text-ink-2">{o.description}</p>}
            <div className="mt-3 rounded-lg bg-paper-2/70 p-3">
              <div className="eyebrow mb-1">Why</div>
              <ul className="space-y-0.5 text-sm text-ink-2">
                {reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                {o.deadline && (
                  <span className={cn("font-semibold", o.deadline.getTime() - Date.now() < 7 * 864e5 ? "text-brand-deep" : "text-ink-2")}>
                    Registration closes {fmtDate(o.deadline)} ({fmtRelative(o.deadline)})
                  </span>
                )}
                {o.prize && <div className="text-xs text-muted">Prize: {o.prize}</div>}
              </div>
              <div className="flex gap-2">
                <ActionButton action={toggleSaveOpportunity} hidden={{ opportunityId: o.id }} variant={isSaved ? "primary" : "outline"}>
                  {isSaved ? "Saved" : "Save"}
                </ActionButton>
                {href && (
                  <a href={href} target={o.eventId ? undefined : "_blank"} rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg bg-ink px-3 text-[13px] font-semibold text-white hover:bg-ink-2">
                    View opportunity {!o.eventId && <ExternalLink className="h-3 w-3" />}
                  </a>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted">External opportunities link to their original registration page. Arthakram never scrapes protected sites — listings are added by admins or via permitted feeds.</p>
    </>
  );
}
