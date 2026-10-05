import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { documents, events, problemStatements, scheduleItems } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { canReadDocument, isEventMember } from "@/server/docs";
import { eventContext, myParticipation, roundsFor } from "@/server/events";
import { can, eventScopeOf } from "@/server/rbac";
import { computeResults } from "@/server/results";
import { registerForEvent } from "@/server/actions/student";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Markdown } from "@/components/markdown";
import { Badge, Card, KV, LinkButton, StatusBadge } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtTime, humanize } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = db.select({ title: events.title, tagline: events.tagline }).from(events).where(eq(events.slug, slug)).get();
  return { title: e?.title ?? "Event", description: e?.tagline ?? undefined };
}

export default async function EventPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const e = db.select().from(events).where(eq(events.slug, slug)).get();
  if (!e) notFound();
  const user = await getCurrentUser();
  const staff = user ? await can(user.id, "events.view", eventScopeOf(e)) : false;
  if ((e.status === "draft" || e.visibility === "private") && !staff && !(user && isEventMember(e.id, user.id))) notFound();
  const ctx = eventContext(e);
  const me = user ? myParticipation(e.id, user.id) : null;
  const member = !!me || (user ? isEventMember(e.id, user.id) : false);
  const sched = db.select().from(scheduleItems).where(eq(scheduleItems.eventId, e.id)).orderBy(asc(scheduleItems.startsAt)).all();
  const showProblems = ["live", "completed", "archived"].includes(e.status) || member || staff;
  const ps = showProblems ? db.select().from(problemStatements).where(eq(problemStatements.eventId, e.id)).orderBy(asc(problemStatements.code)).all() : [];
  const docsAll = db.select().from(documents).where(and(eq(documents.eventId, e.id), eq(documents.status, "published"), inArray(documents.visibility, ["public", "participants"]))).all();
  const docs = [];
  for (const d of docsAll) if (await canReadDocument(d, user?.id ?? null)) docs.push(d);
  const results = e.resultsPublished ? computeResults(e.id) : null;
  const rounds = roundsFor(e.id);
  const deadlinePassed = e.registrationDeadline && e.registrationDeadline < new Date();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/events" className="hover:text-brand-deep">Events</Link> / {ctx.club ? <Link href={`/clubs/${ctx.club.slug}`} className="hover:text-brand-deep">{ctx.club.name}</Link> : ctx.org?.name}
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={e.status} />
            <Badge>{humanize(e.type)}</Badge>
            {e.tags.map((t) => <Badge key={t} tone="brand">{t}</Badge>)}
          </div>
          <h1 className="mt-4 text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.02] tracking-tight">{e.title}</h1>
          {e.tagline && <p className="mt-3 text-xl text-ink-2">{e.tagline}</p>}
          <hr className="rule my-8 max-w-md" />
          <Markdown>{e.description}</Markdown>

          {results && results.rows.length > 0 && (
            <section className="mt-10">
              <div className="eyebrow mb-4 text-brand-deep">Results · {results.round?.name}</div>
              <ol className="space-y-2">
                {results.rows.slice(0, 5).map((r) => (
                  <li key={r.teamId} className="flex items-center gap-4 rounded-xl border border-line bg-card px-4 py-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full font-extrabold ${r.rank === 1 ? "bg-brand text-white" : "bg-paper-2"}`}>{r.rank}</span>
                    <span className="flex-1 font-bold text-ink">{r.teamName}</span>
                    <span className="tabular text-lg font-extrabold">{r.average.toFixed(1)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {e.rules && (
            <section className="mt-10">
              <div className="eyebrow mb-3">Rules</div>
              <Card><Markdown>{e.rules}</Markdown></Card>
            </section>
          )}

          {sched.length > 0 && (
            <section id="schedule" className="mt-10 scroll-mt-24">
              <div className="eyebrow mb-3">Schedule</div>
              <ol className="divide-y divide-line/70 rounded-[var(--radius-card)] border border-line bg-card">
                {sched.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-36 font-bold tabular text-ink">{fmtDateTime(s.startsAt)}</span>
                    <span className="flex-1 font-semibold text-ink-2">{s.title}{s.endsAt && <span className="font-normal text-muted"> – until {fmtTime(s.endsAt)}</span>}</span>
                    {s.location && <span className="text-xs text-muted">{s.location}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {ps.length > 0 && (
            <section id="problems" className="mt-10 scroll-mt-24">
              <div className="eyebrow mb-3">Problem statements</div>
              <div className="grid gap-3 md:grid-cols-2">
                {ps.map((p) => (
                  <Card key={p.id}>
                    <Badge tone="brand">{p.code}</Badge> {p.track && <span className="text-xs text-muted">{p.track}</span>}
                    <div className="mt-2 font-bold text-ink">{p.title}</div>
                    <p className="mt-1 text-sm text-muted">{p.description}</p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {docs.length > 0 && (
            <section id="docs" className="mt-10 scroll-mt-24">
              <div className="eyebrow mb-3">Documentation</div>
              <ul className="grid gap-2 md:grid-cols-2">
                {docs.map((d) => (
                  <li key={d.id}>
                    <Link href={`/events/${e.slug}/docs/${d.id}`} className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3 font-semibold text-ink hover:border-brand">
                      {d.title} <span className="text-xs font-normal text-muted">{humanize(d.section)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <KV
              items={[
                ["When", `${fmtDate(e.startsAt)} – ${fmtDate(e.endsAt)}`],
                ["Where", e.venue ?? humanize(e.mode)],
                ["Format", humanize(e.mode)],
                ["Team size", e.teamSizeMin === e.teamSizeMax ? `${e.teamSizeMax}` : `${e.teamSizeMin}–${e.teamSizeMax}`],
                ...(e.registrationDeadline ? [["Register by", fmtDateTime(e.registrationDeadline)] as [string, string]] : []),
                ...(e.eligibility ? [["Eligibility", e.eligibility] as [string, string]] : []),
                ["Rounds", rounds.map((r) => r.name.split("·")[0]!.trim()).join(" → ") || "—"],
                ["Hosted by", ctx.club?.name ?? ctx.org?.name ?? "—"],
              ]}
            />
            <div className="mt-5 border-t border-line pt-5">
              {me ? (
                <div className="space-y-2">
                  <Badge tone="ok">You’re registered</Badge>
                  <LinkButton href={me.teamId ? `/app/team/${me.teamId}` : "/app/my-events"} className="w-full">{me.teamId ? "Open team workspace" : "Form your team"}</LinkButton>
                </div>
              ) : e.registrationOpen && !deadlinePassed ? (
                user ? (
                  <ActionForm action={registerForEvent} hidden={{ eventId: e.id }}>
                    <SubmitButton size="lg" className="w-full">Register now</SubmitButton>
                  </ActionForm>
                ) : (
                  <LinkButton href={`/login?next=/events/${e.slug}`} size="lg" className="w-full">Sign in to register</LinkButton>
                )
              ) : (
                <p className="text-sm text-muted">Registration is closed.</p>
              )}
              {staff && <LinkButton href={`/app/events/${e.id}`} variant="outline" className="mt-2 w-full">Open event workspace</LinkButton>}
            </div>
          </Card>
          {e.prizes && <Card title="Prizes"><Markdown>{e.prizes}</Markdown></Card>}
          {e.sponsors.length > 0 && (
            <Card title="Partners">
              <div className="flex flex-wrap gap-2">{e.sponsors.map((s) => <Badge key={s}>{s}</Badge>)}</div>
            </Card>
          )}
          {["live", "completed", "archived"].includes(e.status) && (
            <Link href={`/events/${e.slug}/feedback`} className="block text-center text-sm font-semibold text-brand-deep hover:underline">Leave feedback →</Link>
          )}
          {e.contactEmail && <p className="text-center text-xs text-muted">Questions? {e.contactEmail}</p>}
        </aside>
      </div>
    </div>
  );
}
