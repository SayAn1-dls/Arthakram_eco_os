import Link from "next/link";
import { and, count, eq, inArray } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { clubs, events, mentorProfiles, opportunities, organizations, participants, teams } from "@/db/schema";
import { Feather } from "@/components/logo";
import { Badge, LinkButton, StatusBadge } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export default async function Landing() {
  const n = (q: { n: number } | undefined) => q?.n ?? 0;
  const stats = {
    events: n(db.select({ n: count() }).from(events).where(inArray(events.status, ["published", "live", "completed", "archived"])).get()),
    teams: n(db.select({ n: count() }).from(teams).get()),
    participants: n(db.select({ n: count() }).from(participants).get()),
    clubs: n(db.select({ n: count() }).from(clubs).get()),
    mentors: n(db.select({ n: count() }).from(mentorProfiles).where(eq(mentorProfiles.status, "approved")).get()),
    opps: n(db.select({ n: count() }).from(opportunities).where(eq(opportunities.status, "active")).get()),
    orgs: n(db.select({ n: count() }).from(organizations).get()),
  };
  const featured = db
    .select()
    .from(events)
    .where(and(eq(events.visibility, "public"), inArray(events.status, ["live", "published"])))
    .orderBy(events.startsAt)
    .all()
    .sort((a, b) => Number(b.status === "live") - Number(a.status === "live"))
    .slice(0, 3);

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 lg:pt-20">
        <svg className="pointer-events-none absolute -right-24 -top-10 hidden h-[420px] w-[420px] text-ink/80 lg:block" viewBox="0 0 200 200" aria-hidden>
          <path d="M20 0 Q170 40 200 200" stroke="currentColor" strokeWidth="1.6" fill="none" />
        </svg>
        <div className="eyebrow mb-6 text-brand-deep">Arthakram Ecosystem OS · Founders Day 2026</div>
        <div className="grid gap-12 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <h1 className="text-[clamp(2.6rem,6.5vw,5.2rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
              Discover where
              <br />
              you belong.
              <br />
              <span className="highlight">Run what you build.</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-2">
              One operating system for the college ecosystem. Students find clubs, competitions, mentors and their next step. Clubs and organizers create, run, judge, document and archive every event — from one workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/signup" size="lg">
                Get started <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton href="/explore" variant="outline" size="lg">
                Explore the ecosystem
              </LinkButton>
            </div>
          </div>
          <div className="lg:pt-4">
            <div className="eyebrow mb-6">What it does</div>
            <ul className="space-y-6">
              {[
                ["For students", "Find your club, compete, get mentored, build an evidence-based passport."],
                ["For organizers", "Events, teams, timers, QR, judging, results and documentation in one control room."],
                ["For admins", "Control, delegate and audit — role-based access down to a single event."],
              ].map(([t, b]) => (
                <li key={t}>
                  <div className="dash text-xl font-bold text-ink">{t}</div>
                  <p className="mt-1 pl-[1.85rem] text-[15px] text-muted">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16">
          <div className="eyebrow mb-3">By the numbers</div>
          <hr className="rule mb-6 max-w-xl" />
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-6">
            {[
              [stats.events, "Events & competitions"],
              [stats.participants, "Registrations"],
              [stats.teams, "Teams"],
              [stats.clubs, "Clubs"],
              [stats.mentors, "Mentors"],
              [stats.opps, "Live opportunities"],
            ].map(([v, l]) => (
              <div key={l as string}>
                <div className="text-[2.6rem] font-extrabold leading-none tracking-tight tabular">{v}+</div>
                <div className="mt-2 text-sm text-ink-2">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fragmentation → one workspace */}
      <section className="border-y border-line bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr]">
            <div>
              <div className="eyebrow mb-4">Today, one college event uses</div>
              <div className="flex flex-wrap gap-2">
                {["WhatsApp", "Google Forms", "Sheets", "Notion", "Drive", "A timer app", "QR generator", "Judging sheets", "Feedback forms", "Result sheets"].map((t) => (
                  <span key={t} className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-muted line-through decoration-brand/60">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <ArrowRight className="mx-auto h-8 w-8 rotate-90 text-brand lg:rotate-0" />
            <div className="rounded-2xl border border-brand bg-brand p-6 text-white">
              <div className="eyebrow !text-white/80">With Arthakram</div>
              <div className="mt-2 text-2xl font-extrabold">One Event Workspace</div>
              <p className="mt-2 text-white/90">Control room, teams, rounds, live timers, QR check-in, rubrics, judges, submissions, results, announcements and documentation — the single source of truth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live & upcoming */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="eyebrow mb-2 text-brand-deep">Happening on Arthakram</div>
            <h2 className="text-3xl font-extrabold tracking-tight">Live & upcoming</h2>
          </div>
          <Link href="/events" className="text-sm font-semibold text-brand-deep hover:underline">
            All events →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {featured.map((e) => (
            <Link key={e.id} href={`/events/${e.slug}`} className={`group flex flex-col rounded-[var(--radius-card)] border p-6 transition-colors hover:border-brand ${e.status === "live" ? "border-brand bg-brand-wash/60" : "border-line bg-card"}`}>
              <div className="flex items-center gap-2">
                <StatusBadge status={e.status} />
                <span className="text-xs text-muted">{humanize(e.type)}</span>
              </div>
              <div className="mt-4 text-xl font-extrabold leading-tight text-ink">{e.title}</div>
              <p className="mt-2 flex-1 text-sm text-muted">{e.tagline}</p>
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink-2">{fmtDate(e.startsAt)}</span>
                {e.registrationOpen && <Badge tone="ok">Registration open</Badge>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Journey */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            ["Student", ["Discover", "Join", "Learn", "Compete", "Build", "Get mentored", "Get feedback", "Improve", "Next opportunity"]],
            ["Organization", ["Create", "Organize", "Operate", "Judge", "Document", "Publish", "Archive"]],
            ["Admin", ["Control", "Configure", "Delegate", "Monitor", "Analyze"]],
          ].map(([who, steps]) => (
            <div key={who as string} className="rounded-[var(--radius-card)] border border-line bg-card p-6">
              <div className="eyebrow mb-4">For the {(who as string).toLowerCase()}</div>
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px] font-semibold text-ink">
                {(steps as string[]).map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    {s}
                    {i < (steps as string[]).length - 1 && <span className="text-brand">→</span>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {/* Find my club CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid items-center gap-8 rounded-[var(--radius-card)] border border-line bg-paper-2 p-8 lg:grid-cols-[1fr_auto] lg:p-12">
          <div>
            <div className="eyebrow mb-3 text-brand-deep">First year?</div>
            <h2 className="text-3xl font-extrabold tracking-tight">Not sure which club is yours?</h2>
            <p className="mt-2 max-w-xl text-ink-2">Find My Club scores how you think across 12 dimensions and explains every match: what you’ll learn, what you’ll do, and your first three steps.</p>
          </div>
          <LinkButton href="/app/find-my-club" size="lg">
            Find my club
          </LinkButton>
        </div>
      </section>

      {/* Orange band, as on the poster */}
      <section className="relative mt-4">
        <svg viewBox="0 0 1440 140" className="block w-full" preserveAspectRatio="none" aria-hidden>
          <path d="M0 70 Q720 -10 1440 60 L1440 78 Q720 10 0 92Z" fill="#fcd9c3" />
          <path d="M0 100 Q720 25 1440 92 L1440 110 Q720 48 0 122Z" fill="#f9a26b" />
          <path d="M0 140 L0 128 Q720 60 1440 120 L1440 140Z" fill="#f26a1b" />
        </svg>
        <div className="bg-brand pb-16 pt-6 text-center">
          <div className="eyebrow !text-[0.9rem] !tracking-[0.35em] text-ink">Arthakram for the</div>
          <div className="mt-2 text-[clamp(4rem,12vw,8rem)] font-extrabold leading-none text-ink">1%</div>
          <div className="mt-6 flex justify-center">
            <Feather className="h-10 w-10 !text-ink" />
          </div>
        </div>
      </section>
    </div>
  );
}
