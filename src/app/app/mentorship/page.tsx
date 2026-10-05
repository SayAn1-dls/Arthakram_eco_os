import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mentorProfiles, mentorRequests, mentorReviews, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { mentorMatches } from "@/server/student";
import { Avatar, Badge, Card, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";
import { fmtDate, humanize } from "@/lib/format";

export const metadata = { title: "Mentorship" };

export default async function Mentorship() {
  const user = await requireUser();
  const reqs = db.select({ r: mentorRequests, mentor: users.name }).from(mentorRequests).innerJoin(users, eq(users.id, mentorRequests.mentorId)).where(eq(mentorRequests.studentId, user.id)).orderBy(desc(mentorRequests.createdAt)).all();
  const reviews = db.select({ r: mentorReviews, mentor: users.name }).from(mentorReviews).innerJoin(users, eq(users.id, mentorReviews.mentorId)).where(eq(mentorReviews.studentId, user.id)).orderBy(desc(mentorReviews.createdAt)).all();
  const score = mentorMatches(user.id);
  const mentors = db
    .select({ m: mentorProfiles, name: users.name })
    .from(mentorProfiles)
    .innerJoin(users, eq(users.id, mentorProfiles.userId))
    .where(eq(mentorProfiles.status, "approved"))
    .all()
    .filter((x) => x.m.userId !== user.id)
    .map((x) => ({ ...x, match: score(x.m) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 3);
  return (
    <>
      <PageHeader eyebrow="Mentor Connect" title="Mentorship" description="Request structured reviews of your projects, cases and pitches. Feedback becomes part of your Student Passport." actions={<LinkButton href="/mentors">Browse all mentors</LinkButton>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="My requests">
            {reqs.length === 0 ? (
              <EmptyState title="No requests yet" action={<LinkButton href="/mentors" size="sm">Find a mentor</LinkButton>} />
            ) : (
              <ul className="divide-y divide-line/70">
                {reqs.map(({ r, mentor }) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <div className="font-semibold text-ink">{r.topic}</div>
                      <div className="text-xs text-muted">
                        {mentor} · {humanize(r.workType)} · {fmtDate(r.createdAt)}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Reviews received">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted">Completed reviews show up here and on your passport.</p>
            ) : (
              <ul className="space-y-6">
                {reviews.map(({ r, mentor }) => (
                  <li key={r.id}>
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-ink">{r.title}</div>
                      <span className="text-xs text-muted">
                        {mentor} · {fmtDate(r.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {r.scores.map((s) => (
                        <div key={s.dimension} className="rounded-lg bg-paper-2/70 p-2">
                          <div className="text-xl font-bold tabular">
                            {s.score}
                            <span className="text-sm text-muted">/10</span>
                          </div>
                          <div className="text-xs text-ink-2">{s.dimension}</div>
                        </div>
                      ))}
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      {[
                        ["Strengths", r.strengths],
                        ["Weaknesses", r.weaknesses],
                        ["Improvement areas", r.improvements],
                        ["Next steps", r.nextSteps],
                      ]
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt className="font-semibold text-ink">{k}</dt>
                            <dd className="text-ink-2">{v}</dd>
                          </div>
                        ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Suggested mentors" eyebrow="Matched to your profile">
          <ul className="space-y-4">
            {mentors.map(({ m, name, match }) => (
              <li key={m.userId} className="flex gap-3">
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                  <Link href={`/mentors/${m.userId}`} className="font-bold text-ink hover:text-brand-deep">
                    {name}
                  </Link>
                  <div className="text-xs text-muted">{m.headline}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone="solid">{match.score}%</Badge>
                    {match.hits.slice(0, 2).map((h) => (
                      <Badge key={h}>{h}</Badge>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
