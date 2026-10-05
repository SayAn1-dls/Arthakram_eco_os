import Link from "next/link";
import { requireUser } from "@/server/auth";
import { passport, profileOf } from "@/server/student";
import { PrintButton } from "@/components/print-button";
import { Avatar, Badge, Card, EmptyState, PageHeader, Stat, StatRow } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export const metadata = { title: "Student Passport" };

export default async function PassportPage() {
  const user = await requireUser();
  const p = passport(user.id);
  const profile = profileOf(user.id);
  const results = new Map<string, number[]>();
  for (const s of p.scored) results.set(s.eventId, [...(results.get(s.eventId) ?? []), s.total ?? 0]);
  return (
    <>
      <PageHeader eyebrow="Me" title="My passport" description="Everything you’ve done on Arthakram in one place: events, submissions, results, mentor reviews and clubs. Download it as a PDF for applications." actions={<PrintButton label="Export PDF" />} />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} size={64} />
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{user.name}</h2>
            <p className="text-sm text-muted">
              {user.headline ?? profile?.program ?? "Arthakram member"}
              {profile?.year ? ` · Year ${profile.year}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(profile?.skills ?? []).map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <StatRow className="mb-6 lg:grid-cols-5">
        <Stat value={p.history.length} label="Competitions & events" />
        <Stat value={p.submissions.length} label="Submissions" />
        <Stat value={p.awards.length} label="Awards" tone="brand" />
        <Stat value={p.reviews.length} label="Mentor reviews" />
        <Stat value={p.clubs.length} label="Clubs" />
      </StatRow>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card title="Skills you’ve shown" eyebrow="Each one backed by things you’ve actually done">
          {p.skills.length === 0 ? (
            <EmptyState title="No evidence yet">Join an event or request a mentor review to start your passport.</EmptyState>
          ) : (
            <ul className="space-y-4">
              {p.skills.slice(0, 6).map((s) => (
                <li key={s.dim}>
                  <div className="font-bold text-ink">{s.label}</div>
                  <div className="mt-1 text-sm text-muted">
                    Evidence:{" "}
                    {[
                      s.competitions && `${s.competitions} competition${s.competitions > 1 ? "s" : ""}`,
                      s.projects && `${s.projects} submission${s.projects > 1 ? "s" : ""}`,
                      s.reviews && `${s.reviews} mentor review${s.reviews > 1 ? "s" : ""}`,
                      s.awards && `${s.awards} award${s.awards > 1 ? "s" : ""}`,
                      s.clubs && `${s.clubs} club`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Awards & results">
          {p.awards.length === 0 ? (
            <p className="text-sm text-muted">Awards appear when organizers publish results.</p>
          ) : (
            <ul className="space-y-3">
              {p.awards.map(({ a, e }) => (
                <li key={a.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand font-bold text-white">{a.rank}</span>
                  <div>
                    <div className="font-bold text-ink">{a.title}</div>
                    <Link href={`/events/${e.slug}`} className="text-xs text-muted hover:text-brand-deep">
                      {fmtDate(e.startsAt)} · verified by organizers
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Competition history">
          <ul className="divide-y divide-line/70">
            {p.history.map((h) => {
              const sc = results.get(h.e.id);
              return (
                <li key={h.p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <Link href={`/events/${h.e.slug}`} className="font-semibold text-ink hover:text-brand-deep">
                      {h.e.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {humanize(h.e.type)} · {fmtDate(h.e.startsAt)}
                      {h.team && ` · ${h.team.name}`}
                    </div>
                  </div>
                  {sc && <Badge tone="info">Avg judge score {(sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1)}</Badge>}
                </li>
              );
            })}
            {p.history.length === 0 && <li className="py-3 text-sm text-muted">No events yet.</li>}
          </ul>
        </Card>
        <Card title="Mentor feedback">
          {p.reviews.length === 0 ? (
            <p className="text-sm text-muted">
              No reviews yet. <Link href="/mentors" className="font-semibold text-brand-deep">Find a mentor</Link>.
            </p>
          ) : (
            <ul className="space-y-5">
              {p.reviews.map(({ r, mentor }) => (
                <li key={r.id}>
                  <div className="font-bold text-ink">{r.title}</div>
                  <div className="text-xs text-muted">
                    {mentor} · {humanize(r.workType)} · {fmtDate(r.createdAt)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {r.scores.map((s) => (
                      <div key={s.dimension} className="flex justify-between">
                        <span className="text-ink-2">{s.dimension}</span>
                        <b className="tabular">{s.score}/10</b>
                      </div>
                    ))}
                  </div>
                  {r.strengths && <p className="mt-2 text-sm"><b className="text-ok">Strengths:</b> {r.strengths}</p>}
                  {r.improvements && <p className="text-sm"><b className="text-brand-deep">Improve:</b> {r.improvements}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Clubs" className="mt-6">
        <div className="flex flex-wrap gap-2">
          {p.clubs.map((c) => (
            <Link key={c.club.id} href={`/clubs/${c.club.slug}`}>
              <Badge tone="brand">
                {c.club.name} · {humanize(c.role)}
              </Badge>
            </Link>
          ))}
          {p.clubs.length === 0 && <span className="text-sm text-muted">Not in a club yet.</span>}
        </div>
      </Card>
    </>
  );
}
